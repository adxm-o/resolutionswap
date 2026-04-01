var sharp = require("sharp");
var path = require("path");
var fs = require("fs");

var svgPath = path.join(__dirname, "..", "assets", "icon.svg");
var pngPath = path.join(__dirname, "..", "assets", "icon.png");

if (fs.existsSync(pngPath)) {
  console.log("  icon.png exists, skipping.");
  process.exit(0);
}

sharp(svgPath)
  .resize(256, 256)
  .png()
  .toFile(pngPath)
  .then(function() { console.log("  Generated assets/icon.png"); })
  .catch(function(err) {
    console.error("  Icon generation failed:", err.message);
    process.exit(1);
  });
