const puppeteer = require("puppeteer");
const fs = require("fs");

async function scrapeContent(url) {
  const browser = await puppeteer.launch({ headless: false });
  const page = await browser.newPage();
  const outputData = { content: [] };
  let repeatedMessageCount = 0;
  try {
    await page.goto(url);
    await page.waitForSelector(".player");
    const iframeElement = await page.$(".player");
    const iframeFrame = await iframeElement.contentFrame();
    await iframeFrame.waitForSelector("#next");

    let lastSlideContent = null;
    let slideIndex = 1;

    const getSlideData = async () => {
      return await iframeFrame.evaluate(() => {
        const elements = document.querySelectorAll(
          ".slide-container #slide-window .slide-transition-container .slide-layer .slide-object"
        );
        return Array.from(elements)
          .map((el) => el.getAttribute("data-acc-text"))
          .filter((text) => text && text.trim() !== "" && text.length > 20);
      });
    };

    const processSlide = async (index) => {
      const slideData = await getSlideData();
      const slideDataString = JSON.stringify(slideData);

      if (slideDataString === lastSlideContent) {
        repeatedMessageCount++;
        console.log(
          `No new content for slide ${index}. Waiting for navigation. (${repeatedMessageCount}/2)`
        );
        return false;
      }

      lastSlideContent = slideDataString;
      repeatedMessageCount = 0;
      if (slideData.length > 0) {
        const title = slideData[0];
        const longestContent = slideData
          .slice(1)
          .sort((a, b) => b.length - a.length)[0];
        const processedContent = [title, longestContent].filter(Boolean);

        outputData.content.push({ slide: index, data: processedContent });
        console.log(`Processed Slide ${index}:`, processedContent);
        return true;
      } else {
        console.log(`No meaningful content found on slide ${index}.`);
        return false;
      }
    };

    while (true) {
      if (repeatedMessageCount >= 2) {
        console.log("Stopping scraping due to repeated messages.");
        break;
      }

      const isNewSlide = await processSlide(slideIndex);
      if (isNewSlide) {
        console.log(
          `Slide ${slideIndex} processed. Navigating to the next slide.`
        );
        slideIndex++;
      }
      await new Promise((resolve) => setTimeout(resolve, 10000));
    }
  } catch (error) {
    console.error("Error during scraping:", error);
  } finally {
    await browser.close();
    fs.writeFileSync("output.json", JSON.stringify(outputData, null, 2));
    console.log("Scraping completed. Output written to output.json");
  }
}

const url =
  "https://360.articulate.com/review/content/f01749e5-807f-4656-a484-cc216ad22af2/review";
scrapeContent(url);
