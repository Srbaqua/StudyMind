"use client";

import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import type { Topic, TopicEdge, GraphStatus } from "@/types";

export function useTopicGraph() {
  const [topics, setTopics] = useState<Topic[]>([]);
  const [edges, setEdges] = useState<TopicEdge[]>([]);
  const [graphStatus, setGraphStatus] = useState<GraphStatus>({
    topicsCount: 0,
    edgesCount: 0,
    chunksCount: 0,
    lastBuilt: null,
    isBuilding: false,
  });
  const [isLoading, setIsLoading] = useState(true);

  const fetchGraph = useCallback(async () => {
    setIsLoading(true);
    const [topicsRes, edgesRes, statusRes] = await Promise.all([
      supabase.from("topics").select("id, name, summary, chunk_count, x2d, y2d, created_at"),
      supabase.from("topic_edges").select("from_id, to_id, weight"),
      fetch("/api/graph-status").then((r) => r.json()),
    ]);

    setTopics((topicsRes.data ?? []) as Topic[]);
    setEdges((edgesRes.data ?? []) as TopicEdge[]);
    setGraphStatus(statusRes as GraphStatus);
    setIsLoading(false);
  }, []);

  useEffect(() => {
    fetchGraph();
  }, [fetchGraph]);

  return { topics, edges, graphStatus, isLoading, refetch: fetchGraph };
}
