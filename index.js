const puppeteer = require("puppeteer");
const fs = require("fs");

async function scrapeContent(url) {
  const browser = await puppeteer.launch({ headless: false });
  const page = await browser.newPage();
  const outputData = { content: [] };

  try {
    await page.goto(url);
    await page.waitForSelector(".player");

    const iframeElement = await page.$(".player");
    const iframeFrame = await iframeElement.contentFrame();
    await iframeFrame.waitForSelector("#next");

    let previousSlideContent = null; // To track the last processed content
    let slideIndex = 1;

    const getSlideData = async () => {
      const targetData = await iframeFrame.evaluate(() => {
        const elements = document.querySelectorAll(
          ".slide-container #slide-window .slide-transition-container .slide-layer .slide-object"
        );

        // Filter out empty and short texts for better data extraction
        return Array.from(elements)
          .map((element) => element.getAttribute("data-acc-text"))
          .filter((text) => text && text.trim() !== "" && text.length > 20);
      });

      return targetData;
    };

    const processSlideData = async (slideIndex) => {
      const slideData = await getSlideData();

      // If the content matches the previously processed slide, skip processing
      if (JSON.stringify(slideData) === JSON.stringify(previousSlideContent)) {
        return false;
      }

      previousSlideContent = slideData; // Update the previous slide content

      const title = slideData.length > 0 ? slideData[0] : null;
      const longestContent = slideData
        .filter((item) => item !== title)
        .sort((a, b) => b.length - a.length)[0];

      const output = [title, longestContent].filter(Boolean);

      if (output.length > 0) {
        console.log(`Processed Strings (Slide ${slideIndex}):`, output);
        outputData.content.push({ slide: slideIndex, data: output });
        return true;
      } else {
        console.log(`No meaningful content found (Slide ${slideIndex}).`);
        return false;
      }
    };

    while (true) {
      const isNewSlide = await processSlideData(slideIndex);

      if (isNewSlide) {
        console.log(
          `Processed slide ${slideIndex}. Click "Next" button to move to the next slide.`
        );
        slideIndex++;
      } else {
        console.log("Waiting for user to navigate to the next slide...");
      }

      // Wait 10 seconds before checking again
      await new Promise((resolve) => setTimeout(resolve, 10000));
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
