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

    const getSlideData = async () => {
      const targetData = await iframeFrame.evaluate(() => {
        const elements = document.querySelectorAll(".slide-container #slide-window .slide-transition-container .slide-layer .slide-object");
        return Array.from(elements)
          .map(element => element.getAttribute("data-acc-text"))
          .filter(text => text && text.trim() !== "");
      });
      return targetData;
    };

    const initialSlideData = await getSlideData();
    if (initialSlideData.length > 0) {
      fs.writeFile("output.json", JSON.stringify({ initialSlideData }, null, 2), (err) => {
        if (err) {
          console.error("Error writing initial slide data:", err);
        } else {
          console.log("Initial slide data saved to output.json");
        }
      });
    } else {
      console.log("No slide-object elements with non-empty data-acc-text found in the iframe.");
    }
    const cursorHoverElements = await iframeFrame.$$(".cursor-hover");
    for (let i = 0; i < cursorHoverElements.length; i++) {
      await cursorHoverElements[i].click();
      await page.waitForTimeout(3000);

      const newSlideData = await getSlideData();

      if (newSlideData.length > 0) {
        fs.appendFile("output.json", JSON.stringify({ [`newSlideData${i + 1}`]: newSlideData }, null, 2), (err) => {
          if (err) {
            console.error("Error appending new slide data:", err);
          } else {
            console.log(`New slide data ${i + 1} appended to output.json`);
          }
        });
      } else {
        console.log(`No slide-object elements with non-empty data-acc-text found on slide ${i + 1}.`);
      }
    }

  } catch (error) {
    console.error("Error scraping content:", error);
  } finally {
    await browser.close();
  }
}

const url = "https://360.articulate.com/review/content/f01749e5-807f-4656-a484-cc216ad22af2/review";
scrapeContent(url);
