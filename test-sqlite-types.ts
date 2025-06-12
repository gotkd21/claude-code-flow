import { DB } from "https://deno.land/x/sqlite@v3.9.1/mod.ts";

// Test to understand the correct types
const db = new DB(":memory:");

// Check what types the query method expects
console.log("DB instance created");

// Test with simple query
const result1 = db.query("SELECT 1 as test");
console.log("Query result:", result1);

// Test with parameters
const result2 = db.query("SELECT ? as value", [42]);
console.log("Query with params:", result2);

// Test with string parameter
const result3 = db.query("SELECT ? as name", ["test"]);
console.log("Query with string:", result3);

// Check INSERT
db.query("CREATE TABLE test (id INTEGER, name TEXT)");
db.query("INSERT INTO test (id, name) VALUES (?, ?)", [1, "hello"]);
const result4 = db.query("SELECT * FROM test");
console.log("Table data:", result4);

db.close();