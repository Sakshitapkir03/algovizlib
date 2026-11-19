import { definePattern } from "@/lib/catalog";

export const triePattern = definePattern({
  slug: "trie",
  categorySlug: "dsa",
  group: "trees-graphs",
  name: "Trie",
  summary:
    "Store words in a tree of characters so every word sharing a prefix shares the same path, and prefix questions cost only the length of the prefix.",
  whenToUse: [
    'many lookups by prefix, like autocomplete or "does any word start with…"',
    "matching many words against one text or grid at the same time",
    "finding the shortest or longest stored prefix of a word",
    "wildcard search where one character can stand for any letter",
  ],
  coreIdea:
    "A trie (prefix tree) has one edge per character: the path from the root spells a prefix, and a node marked as a word end means that path is a complete stored word. Because words with the same beginning share the same nodes, a lookup walks at most one node per character of the query, no matter how many words are stored, and stopping early tells you no stored word has that prefix. That shared structure is what lets you prune: when searching a grid or expanding a wildcard, you abandon a path the moment the trie has no child for the next character.",
  typicalComplexity: { time: "O(L) per word or prefix", space: "O(total characters)" },
  order: 15,
});
