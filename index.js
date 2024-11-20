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

    const getTranscriptContent = async () => {
      return await iframeFrame.evaluate(() => {
        const transcriptElement = document.querySelector("#transcript-content");
        return transcriptElement ? transcriptElement.textContent.trim() : null;
      });
    };

    const processSlide = async (index) => {
      const slideData = await getSlideData();
      const transcriptContent = await getTranscriptContent();
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
      const slideObject = { slide: index, data: [] };

      if (slideData.length > 0) {
        const title = slideData[0];
        const longestContent = slideData
          .slice(1)
          .sort((a, b) => b.length - a.length)[0];
        slideObject.data.push(...[title, longestContent].filter(Boolean));
      }

      if (transcriptContent) {
        if (!slideObject.data.includes(transcriptContent)) {
          slideObject.data.push({ transcript: transcriptContent });
          console.log(`Unique transcript content added for slide ${index}:`, transcriptContent);
        } else {
          console.log(`Transcript content matches slide ${index}, skipping addition.`);
        }
      }

      if (slideObject.data.length > 0) {
        outputData.content.push(slideObject);
        console.log(`Processed Slide ${index}:`, slideObject.data);
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
  "https://360.articulate.com/review/content/cbb5baca-a726-47d8-a1cf-dec1c6dc38a6/review";
scrapeContent(url);
