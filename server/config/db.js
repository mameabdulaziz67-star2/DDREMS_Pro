"use strict";
const { Pool } = require("pg");
const dotenv = require("dotenv");
const path = require("path");

dotenv.config({ path: path.resolve(__dirname, "../../.env") });

const pool = process.env.DATABASE_URL
  ? new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false },
      max: 10,
      connectionTimeoutMillis: 10000,
      idleTimeoutMillis: 30000,
    })
  : new Pool({
      host: process.env.DB_HOST || "localhost",
      user: process.env.DB_USER || "postgres",
      password: String(process.env.DB_PASSWORD || ""),
      database: process.env.DB_NAME || "ddrems",
      port: parseInt(process.env.DB_PORT) || 5432,
      max: 10,
      connectionTimeoutMillis: 10000,
      idleTimeoutMillis: 30000,
    });

pool.on("error", (err) => {
  console.error("[DB] Pool error:", err.message);
});

// Convert ? placeholders to $1, $2 (MySQL → PostgreSQL compat)
function convertPlaceholders(text) {
  let i = 0;
  return text.replace(/\?/g, () => `$${++i}`);
}

async function executeQuery(queryFn, text, params) {
  const convertedText = convertPlaceholders(text);
  const trimmed = convertedText.trim().toUpperCase();
  const isInsert = trimmed.startsWith("INSERT");
  const isUpdate = trimmed.startsWith("UPDATE");
  const isDelete = trimmed.startsWith("DELETE");

  let finalText = convertedText;
  if (isInsert && !convertedText.toUpperCase().includes("RETURNING")) {
    finalText = convertedText.replace(/;?\s*$/, " RETURNING id");
  }

  const result = await queryFn(finalText, params);

  if (isInsert) {
    return [{ insertId: result.rows[0]?.id, affectedRows: result.rowCount, rows: result.rows }, []];
  }
  if (isUpdate || isDelete) {
    return [{ affectedRows: result.rowCount, changedRows: result.rowCount }, []];
  }
  return [result.rows, result.fields || []];
}

const db = {
  query: async (text, params) => executeQuery((t, p) => pool.query(t, p), text, params),
  pool,
  getConnection: async () => {
    const client = await pool.connect();
    return {
      execute: (text, params) => executeQuery((t, p) => client.query(t, p), text, params),
      query: (text, params) => executeQuery((t, p) => client.query(t, p), text, params),
      release: () => client.release(),
      beginTransaction: () => client.query("BEGIN"),
      commit: () => client.query("COMMIT"),
      rollback: () => client.query("ROLLBACK"),
    };
  },
};

module.exports = db;
