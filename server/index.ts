import { boolean, capsule, mutation, query, string, table } from "lakebed/server";

export default capsule({
  name: "2048",

  schema: {
    scores: table({
      score: string(),
      won: boolean().default(false),
      ownerId: string(),
      playerName: string(),
      playerPicture: string()
    })
  },

  queries: {
    bestScore: query((ctx) => {
      if (ctx.auth.isGuest) {
        return { bestScore: 0, hasPlayed: false };
      }
      const scores = ctx.db.scores
        .where("ownerId", ctx.auth.userId)
        .orderBy("createdAt", "desc")
        .all();
      if (scores.length === 0) {
        return { bestScore: 0, hasPlayed: false };
      }
      const best = scores.reduce((max, s) => Math.max(max, parseInt(s.score, 10)), 0);
      return { bestScore: best, hasPlayed: true };
    }),

    leaderboard: query((ctx) => {
      const allScores = ctx.db.scores.orderBy("createdAt", "desc").all();
      // Deduplicate to one entry per user (their best score)
      const bestPerUser: Map<string, typeof allScores[0]> = new Map();
      for (const s of allScores) {
        const val = parseInt(s.score, 10);
        const existing = bestPerUser.get(s.ownerId);
        if (!existing || val > parseInt(existing.score, 10)) {
          bestPerUser.set(s.ownerId, s);
        }
      }
      // Sort by score descending, take top 20
      const sorted = Array.from(bestPerUser.values()).sort(
        (a, b) => parseInt(b.score, 10) - parseInt(a.score, 10)
      );
      return sorted.slice(0, 20);
    })
  },

  mutations: {
    saveScore: mutation((ctx, score: number, won: boolean) => {
      if (ctx.auth.isGuest) return;
      const existing = ctx.db.scores
        .where("ownerId", ctx.auth.userId)
        .all();
      const currentBest = existing.reduce((max, s) => Math.max(max, parseInt(s.score, 10)), 0);

      if (score > currentBest) {
        ctx.db.scores.insert({
          score: String(score),
          won,
          ownerId: ctx.auth.userId,
          playerName: ctx.auth.displayName ?? ctx.auth.email ?? "Anonymous",
          playerPicture: ctx.auth.picture ?? ""
        });
      }
    })
  }
});
