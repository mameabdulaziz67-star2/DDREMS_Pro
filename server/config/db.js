const { Pool } = require("pg");
const dotenv = require("dotenv");
const path = require("path");

dotenv.config({ path: path.resolve(__dirname, "../../.env") });

// Railway provides DATABASE_URL, support both styles
const pool = process.env.DATABASE_URL
  ? new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false },
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    })
  : new Pool({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: String(process.env.DB_PASSWORD),
      database: process.env.DB_NAME,
      port: parseInt(process.env.DB_PORT) || 5432,
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    });

pool.on("error", (err) => {
  console.error("Unexpected error on idle client", err);
});

// Convert MySQL-style ? placeholders to PostgreSQL $1, $2, etc.
function convertPlaceholders(text) {
  let i = 0;
  return text.replace(/\?/g, () => `$${++i}`);
}

// Handle MySQL-style batch inserts
function expandBatchInsert(text, params) {
  if (!text.match(/VALUES\s+\?\s*$/i)) return null;
  if (!params || params.length !== 1 || !Array.isArray(params[0])) return null;

  const rows = params[0];
  if (rows.length === 0 || !Array.isArray(rows[0])) return null;

  const allParams = [];
  const valueClauses = [];

  for (const row of rows) {
    const placeholders = [];
    for (const val of row) {
      allParams.push(val);
      placeholders.push(`$${allParams.length}`);
    }
    valueClauses.push(`(${placeholders.join(", ")})`);
  }

  const newText = text.replace(
    /VALUES\s+\?\s*$/i,
    `VALUES ${valueClauses.join(", ")}`
  );
  return { text: newText, params: allParams };
}

async function executeQuery(queryFn, text, params) {
  let convertedText = text;
  let convertedParams = params;

  const batch = expandBatchInsert(text, params);
  if (batch) {
    convertedText = batch.text;
    convertedParams = batch.params;
  } else {
    convertedText = convertPlaceholders(text);
  }

  const trimmed = convertedText.trim().toUpperCase();
  const isInsert = trimmed.startsWith("INSERT");
  const isUpdate = trimmed.startsWith("UPDATE");
  const isDelete = trimmed.startsWith("DELETE");

  if (isInsert && !convertedText.toUpperCase().includes("RETURNING")) {
    convertedText = convertedText.replace(/;?\s*$/, " RETURNING id");
  }

  const result = await queryFn(convertedText, convertedParams);

  if (isInsert) {
    return [
      {
        insertId: result.rows[0]?.id,
        affectedRows: result.rowCount,
        rows: result.rows,
      },
      [],
    ];
  }

  if (isUpdate || isDelete) {
    return [{ affectedRows: result.rowCount, changedRows: result.rowCount }, []];
  }

  return [result.rows, result.fields || []];
}

const db = {
  query: async (text, params) => {
    return executeQuery((t, p) => pool.query(t, p), text, params);
  },
  pool: pool,
  getConnection: async () => {
    const client = await pool.connect();
    const clientQuery = (t, p) => client.query(t, p);
    return {
      execute: async (text, params) => executeQuery(clientQuery, text, params),
      query: async (text, params) => executeQuery(clientQuery, text, params),
      release: () => client.release(),
      beginTransaction: async () => await client.query("BEGIN"),
      commit: async () => await client.query("COMMIT"),
      rollback: async () => await client.query("ROLLBACK"),
    };
  },
};

module.exports = db;
