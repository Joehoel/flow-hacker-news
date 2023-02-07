import Parser from "rss-parser";

export const topics = [
  "active",
  "ask",
  "best",
  "bestcomments",
  "classic",
  "frontpage",
  "invited",
  "jobs",
  "launches",
  "newcomments",
  "newest",
  "polls",
  "pool",
  "show",
  "whoishiring",
];

export type Topic = typeof topics[number];
