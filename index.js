const puppeteer = require("puppeteer");
const fs = require("fs");

async function scrapeContent(url) {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();

  try {
    await page.goto(url);
    await page.waitForSelector(".content");

    const contentDiv = await page.$(".content");
    await page.waitForSelector(".player", { timeout: 5000 }); 

    const iframeElement = await contentDiv.$(".player");
    const iframeFrame = await iframeElement.contentFrame();

    const targetData = await iframeFrame.evaluate(() => {
      const elements = document.querySelectorAll(".slide-container #slide-window .slide-transition-container .slide-layer .slide-object");
      return Array.from(elements)
        .map(element => element.getAttribute("data-acc-text"))
        .filter(text => text && text.trim() !== ""); 
    });

    if (targetData.length > 0) {
      fs.writeFile("output.json", JSON.stringify(targetData, null, 2), (err) => {
        if (err) {
          console.error("Error writing data values:", err);
        } else {
          console.log("data values saved to output.json");
        }
      });
    } else {
      console.log("No slide-object elements with non-empty data-acc-text found in the iframe.");
    }
  } catch (error) {
    console.error("Error scraping content:", error);
  } finally {
    await browser.close();
  }
}

const url =
  "https://360.articulate.com/review/content/f01749e5-807f-4656-a484-cc216ad22af2/review";
scrapeContent(url);
