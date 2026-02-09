import { supabase } from "../config/supabase.js";
import { sanitizeInput } from "../middleware/validation.js";

class JijiService {
  async processQuery(query, userId = null) {
    const sanitizedQuery = sanitizeInput(query);

    const queryRecord = await this.saveQuery(sanitizedQuery, userId);

    const resources = await this.findMatchingResources(sanitizedQuery);

    return {
      success: true,
      data: {
        answer: this.generateAnswer(sanitizedQuery, resources),
        resources: resources.map((r) => ({
          id: r.id,
          title: r.title,
          type: r.type,
          url: r.url,
          description: r.description,
        })),
        metadata: {
          queryId: queryRecord?.id ?? null,
          timestamp: new Date().toISOString(),
          resourceCount: resources.length,
        },
      },
    };
  }

  async saveQuery(query, userId) {
    const { data } = await supabase
      .from("queries")
      .insert({
        query_text: query,
        user_id: userId ?? null,
      })
      .select()
      .single();

    return data ?? null;
  }

  async findMatchingResources(query) {
    const keywords = this.extractKeywords(query.toLowerCase());

    const { data } = await supabase
      .from("resources")
      .select("id, title, type, url, description, tags")
      .eq("is_active", true)
      .limit(10);

    if (!data) return [];

    return data.filter((resource) =>
      keywords.some(
        (keyword) =>
          resource.title.toLowerCase().includes(keyword) ||
          resource.description?.toLowerCase().includes(keyword) ||
          resource.tags?.some((tag) => tag.toLowerCase().includes(keyword)),
      ),
    );
  }

  extractKeywords(query) {
    const stopWords = new Set([
      "what",
      "is",
      "how",
      "why",
      "explain",
      "tell",
      "me",
      "about",
      "the",
      "a",
      "an",
    ]);

    return query
      .split(/\s+/)
      .filter((word) => word.length > 2 && !stopWords.has(word))
      .slice(0, 5);
  }

  generateAnswer(query, resources) {
    if (!resources.length) {
      return `I understand you're asking about "${query}". Relevant resources will appear as more content is added.`;
    }

    return `Here are ${resources.length} learning resources related to "${query}" that you may find helpful.`;
  }

  async getQueryHistory(userId, limit = 10) {
    const { data } = await supabase
      .from("queries")
      .select("id, query_text, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(limit);

    return data ?? [];
  }
}

export default new JijiService();
