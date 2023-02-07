import fuzzy from "fuzzy";
import open from "open";
import os from "os";
import Parser from "rss-parser";
import { Flow, JSONRPCResponse } from "./flow-launcher-helper";
import { Topic, topics } from "./types";
import childProcess from "child_process";

const parser = new Parser({
  headers: {
    "User-Agent": `Flow Launcher Extension, Flow/1.0.0 (${os.type()} ${os.release()})`,
  },
});

const copy = (content: string) => childProcess.spawn("clip").stdin.end(content);
// The events are the custom events that you define in the flow.on() method.
const events = ["open", "topic", "comments", "copy"] as const;
type Events = typeof events[number];

const df = new Intl.DateTimeFormat("en-US", { year: "numeric", month: "long", day: "numeric" });

const flow = new Flow<Events>("assets/hacker-news.png");

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

  if (topics.includes(searchTerm.toLowerCase())) {
    try {
      const topic = searchTerm as Topic;

      const feed = await getStories(topic);
      const results: JSONRPCResponse<Events>[] = feed.map(item => {
        return {
          title: item.title ?? "No title",
          subtitle: `${getPoints(item)} points | ${getComments(item)} comments | by: ${
            item.creator
          } | ${df.format(new Date(item.pubDate!))}`,
          method: "open",
          score: parseInt(getPoints(item) ?? "0"),
          context: [item.comments!],
          parameters: [item.link!],
        };
      });
      if (!results.length) {
        throw new Error("No results found");
      }
      flow.showResult(...results);
    } catch (error) {
      flow.showResult({
        title: error instanceof Error ? error.message : "Something went wrong",
      });
    }

    return;
  }

  const result = fuzzy.filter(searchTerm, topics);

  const items: JSONRPCResponse<Events>[] = result.map(item => ({
    title: item.string.substring(0, 1).toUpperCase() + item.string.substring(1, item.string.length),
    subtitle: `Filter topic: ${item.string}`,
    method: "topic",
    parameters: [item.string],
    dontHideAfterAction: true,
  }));

  flow.showResult(...items);
});

flow.on("context_menu", params => {
  const [url] = params;

  flow.showResult({
    title: "Go to Hacker News page",
    subtitle: url.toString(),
    method: "open",
    parameters: [url],
  });
});

flow.on("topic", async params => {
  const topic = params[0].toString() as Topic;

  console.log(
    JSON.stringify({
      method: "Flow.Launcher.ChangeQuery",
      parameters: [`hn ${topic}`, true],
    })
  );

  // console.log(
  //   JSON.stringify({
  //     method: "Flow.Launcher.ChangeQuery",
  //     parameters: ["hallo wereld", true],
  //   })
  // );
});

flow.on("open", params => {
  const url = params[0].toString();
  open(url);
});

flow.on("copy", params => {
  const url = params[0].toString();
  copy(url);
});

flow.run();
