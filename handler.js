"use strict";
const axios = require("axios");
const queryString = require("query-string");

const chromeLambda = require("chrome-aws-lambda");
const puppeteer = chromeLambda.puppeteer;

const aws = require("aws-sdk");
const s3 = new aws.S3();
const dayjs = require("dayjs");

// 設定値
const bucket_name = "serverless-capture-slack-app";
const filename = `capture${dayjs().format("YYYYMMDDHHmmss")}.png`;

module.exports.accept = async (event) => {
  const params = queryString.parse(event.toString());

  await axios.post(params.response_url, {
    response_type: "in_channel",
    text: `処理を受け付けました。`,
  });

  return {
    channel_name: params.channel_name,
    response_url: params.response_url,
  };
};

module.exports.capture = async (event) => {
  const browser = await puppeteer.launch({
    args: chromeLambda.args,
    defaultViewport: chromeLambda.defaultViewport,
    executablePath: await chromeLambda.executablePath,
    headless: chromeLambda.headless,
    ignoreHTTPSErrors: true,
  });

  const page = await browser.newPage();

  // スクリーンショットを撮りたいページにアクセスし、pngデータを取得する。
  await page.goto(`https://www.google.com/`, {
    waitUntil: "networkidle0",
  });
  const png = await page.screenshot({ fullPage: true });

  // S3にアップロードする
  await s3
    .putObject({
      Bucket: bucket_name,
      Key: filename,
      Body: png,
    })
    .promise();

  const download_url = await s3.getSignedUrlPromise("getObject", {
    Bucket: bucket_name,
    Key: filename,
    Expires: 604800,
  });

  await axios.post(event.response_url, {
    response_type: "in_channel",
    text: download_url,
  });
};
