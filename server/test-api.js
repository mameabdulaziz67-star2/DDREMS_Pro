const http = require("http");

http.get("http://localhost:5000/api/agreement-workflow/admin/all", (res) => {
  let d = "";
  res.on("data", c => d += c);
  res.on("end", () => {
    const json = JSON.parse(d);
    console.log("Admin/all agreements:", json.agreements.map(a => ({ id: a.id, has_receipt: !!a.receipt_document })));
  });
});

http.get("http://localhost:5000/api/agreement-workflow/admin/pending", (res) => {
  let d = "";
  res.on("data", c => d += c);
  res.on("end", () => {
    const json = JSON.parse(d);
    console.log("Admin/pending agreements:", json.agreements.map(a => ({ id: a.id, has_receipt: !!a.receipt_document })));
  });
});
