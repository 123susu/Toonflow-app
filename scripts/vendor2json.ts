import fs from "fs";
import path from "path";

const vendorDir = path.join("data", "vendor");
const files = fs.readdirSync(vendorDir).filter((f) => f.endsWith(".ts"));
const result: Record<string, string> = {};
for (const file of files) {
  // Keep the historical CRLF representation stable so regenerating the JSON
  // does not rewrite every embedded vendor template on Unix systems.
  result[file] = fs.readFileSync(path.join(vendorDir, file), "utf-8").replace(/\r?\n/g, "\r\n");
}
const outputFile = path.join("src", "lib", "vendor.json");
fs.writeFileSync(outputFile, JSON.stringify(result, null, 2), "utf-8");
console.log(`Done, saved ${outputFile}`);
