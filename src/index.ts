import open from "open";
import { Flow } from "./flow-launcher-helper";
import Parser from "rss-parser";
import { JSONRPCResponse } from "flow-launcher-helper";
import os from "os";
import { Topic } from "./types";

const parser = new Parser({
  headers: {
    "User-Agent": `Flow Launcher Extension, Flow/1.0.0 (${os.type()} ${os.release()})`,
  },
});
// The events are the custom events that you define in the flow.on() method.
const events = ["open", "topic"] as const;
type Events = typeof events[number];

const flow = new Flow<Events>("assets/npm.png");

function getPoints(item: Parser.Item) {
  const matches = item.contentSnippet?.match(/(?<=Points:\s*)(\d+)/g);
  return matches?.[0] || null;
}

function getComments(item: Parser.Item) {
  const matches = item.contentSnippet?.match(/(?<=Comments:\s*)(\d+)/g);
  return matches?.[0] || null;
}

export async function getStories(topic: Topic | null) {
  if (!topic) {
    return [];
  }

  const feed = await parser.parseURL(`https://hnrss.org/${topic}?count=30`);

  return feed.items;
}

function getScoreBasedOnSearchTerm(searchTerm: string, item: Parser.Item) {
  const score = item.title?.toLowerCase().includes(searchTerm.toLowerCase()) ? 100 : 0;
  return score;
}

flow.on("query", async params => {
  const searchTerm = params[0].toString();

  try {
    const feed = await getStories(Topic.FrontPage);
    const results: JSONRPCResponse<Events>[] = feed.map(item => {
      return {
        title: item.title ?? "No title",
        subtitle: `${getPoints(item)} points | ${getComments(item)} comments | by: ${
          item.creator
        } | ${item.pubDate}`,
        method: "open",
        score: searchTerm.length
          ? getScoreBasedOnSearchTerm(searchTerm, item)
          : parseInt(getPoints(item) ?? "0"),
        params: [item.link!],
        iconPath: "assets/hacker-news.png",
      };
    });
    if (!results.length) {
      throw new Error("No results found");
    }
    return flow.showResult(...results);
  } catch (error) {
    return flow.showResult({
      title: error instanceof Error ? error.message : "Something went wrong",
      iconPath: "assets/hacker-news.png",
    });
  }
});

flow.on("open", params => {
  const url = params[0].toString();
  open(url);
});

flow.run();
