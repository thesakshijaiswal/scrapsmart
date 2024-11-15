const puppeteer = require("puppeteer");
const fs = require("fs");

async function scrapeContent(url) {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  const outputData = { content: [] };

  try {
    await page.goto(url);
    await page.waitForSelector(".content");

    const contentDiv = await page.$(".content");
    await page.waitForSelector(".player", { timeout: 5000 });

    const iframeElement = await contentDiv.$(".player");
    const iframeFrame = await iframeElement.contentFrame();

    const getSlideData = async () => {
      const targetData = await iframeFrame.evaluate(() => {
        const elements = document.querySelectorAll(
          ".slide-container #slide-window .slide-transition-container .slide-layer .slide-object"
        );
        return Array.from(elements)
          .map((element) => element.getAttribute("data-acc-text"))
          .filter((text) => text && text.trim() !== "");
      });
      return targetData;
    };

    const processSlideData = async (slideIndex) => {
      const slideData = await getSlideData();

      const meaningfulData = slideData.filter((item) => item.length > 20);

      const title = meaningfulData.length > 0 ? meaningfulData[0] : null;

      const longestContent = meaningfulData
        .filter((item) => item !== title)
        .sort((a, b) => b.length - a.length)[0];

      const output = [title, longestContent].filter(Boolean);

      if (output.length > 0) {
        console.log(`Processed Strings (Slide ${slideIndex}):`, output);
        outputData.content.push({ slide: slideIndex, data: output });
      } else {
        console.log(`No meaningful content found (Slide ${slideIndex}).`);
      }
    };

    await processSlideData(1);
    const cursorHoverElements = await iframeFrame.$$(".cursor-hover");
    for (let i = 0; i < cursorHoverElements.length; i++) {
      await cursorHoverElements[i].click();
      await page.waitForTimeout(3000);

      console.log(`Processing slide ${i + 2}`);
      await processSlideData(i + 2);
    }
  } catch (error) {
    console.error("Error scraping content:", error);
  } finally {
    await browser.close();

    fs.writeFileSync("output.json", JSON.stringify(outputData, null, 2));
    console.log("Output written to output.json");
  }
}

const url =
  "https://360.articulate.com/review/content/f01749e5-807f-4656-a484-cc216ad22af2/review";
scrapeContent(url);
