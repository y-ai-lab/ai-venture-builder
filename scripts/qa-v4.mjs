import assert from "node:assert/strict";
import {
  EXECUTOR_VERSION,
  SHOPIFY_CSV_BUSINESS,
  autonomyBreakdown,
  evaluateGrowth,
  launchReadiness,
  makeDeliveryMessage,
  makeIntakeMessage,
  makeListingText,
} from "../src/auto-business-executor.mjs";

assert.equal(EXECUTOR_VERSION, "0.4.0");
assert.equal(SHOPIFY_CSV_BUSINESS.price, 5000);
assert.equal(SHOPIFY_CSV_BUSINESS.channel, "ココナラ");
assert.ok(SHOPIFY_CSV_BUSINESS.faq.length >= 5);
assert.ok(SHOPIFY_CSV_BUSINESS.neverGuess.includes("SKU"));

const beforeListing = launchReadiness(SHOPIFY_CSV_BUSINESS, { productImageReady: true, listingInputComplete: false });
assert.equal(beforeListing.readyToPublish, false);
assert.equal(beforeListing.nextAction, "出品画面");
const ready = launchReadiness(SHOPIFY_CSV_BUSINESS, { productImageReady: true, listingInputComplete: true });
assert.equal(ready.readyToPublish, true);

assert.equal(evaluateGrowth({ days: 7, views: 2 }).decision, "IMPROVE");
assert.equal(evaluateGrowth({ days: 14, views: 40, inquiries: 0 }).decision, "IMPROVE");
assert.equal(evaluateGrowth({ days: 30, views: 70, purchases: 0 }).decision, "KILL");
assert.equal(evaluateGrowth({ days: 4, views: 5, purchases: 1, revenue: 5000 }).decision, "KEEP");
assert.equal(autonomyBreakdown().percent, 80);

assert.match(makeListingText(), /5,000円/);
assert.match(makeListingText(), /NEEDS_REVIEW/);
assert.match(makeIntakeMessage(), /パスワード/);
assert.match(makeDeliveryMessage(), /修正版CSV/);

console.log("AUTO BUSINESS EXECUTOR v0.4 QA: PASS");
