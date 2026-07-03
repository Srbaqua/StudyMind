"use client";

import { useEffect, useRef, useCallback } from "react";
import * as d3 from "d3";
import type { Topic, TopicEdge, GraphNode, GraphLink } from "@/types";

interface Props {
  topics: Topic[];
  edges: TopicEdge[];
  onNodeClick: (topic: Topic) => void;
  highlightedIds?: string[];
}

export function TopicGraph({ topics, edges, onNodeClick, highlightedIds = [] }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);

  const draw = useCallback(() => {
    if (!svgRef.current || topics.length === 0) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const width = svgRef.current.clientWidth || 800;
    const height = svgRef.current.clientHeight || 600;

    const g = svg.append("g");

    const zoom = d3
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.3, 3])
      .on("zoom", (event: d3.D3ZoomEvent<SVGSVGElement, unknown>) => {
        g.attr("transform", event.transform.toString());
      });
    svg.call(zoom);

    const nodes: GraphNode[] = topics.map((t) => ({
      ...t,
      x: t.x2d !== undefined ? (t.x2d + 10) * (width / 20) : Math.random() * width,
      y: t.y2d !== undefined ? (t.y2d + 10) * (height / 20) : Math.random() * height,
    }));

    const nodeMap = new Map(nodes.map((n) => [n.id, n]));

    const links: GraphLink[] = edges
      .filter((e) => nodeMap.has(e.from_id) && nodeMap.has(e.to_id))
      .map((e) => ({ source: e.from_id, target: e.to_id, weight: e.weight }));

    const nodeRadius = (d: GraphNode) => Math.min(30, 8 + Math.sqrt(d.chunk_count) * 3);

    const link = g
      .append("g")
      .selectAll("line")
      .data(links)
      .join("line")
      .attr("stroke", "#374151")
      .attr("stroke-opacity", (d) => d.weight)
      .attr("stroke-width", (d) => d.weight * 2);

    const simulation = d3
      .forceSimulation<GraphNode>(nodes)
      .force(
        "link",
        d3
          .forceLink<GraphNode, GraphLink>(links)
          .id((d) => d.id)
          .distance((d) => 160 - (d as GraphLink).weight * 80)
      )
      .force("charge", d3.forceManyBody().strength(-350))
      .force("center", d3.forceCenter(width / 2, height / 2))
      .force("collision", d3.forceCollide<GraphNode>().radius((d) => nodeRadius(d) + 12));

    const node = g
      .append("g")
      .selectAll("circle")
      .data(nodes)
      .join("circle")
      .attr("r", nodeRadius)
      .attr("fill", (d) => (highlightedIds.includes(d.id) ? "#3B82F6" : "#7C3AED"))
      .attr("stroke", (d) => (highlightedIds.includes(d.id) ? "#93C5FD" : "#4C1D95"))
      .attr("stroke-width", 1.5)
      .attr("cursor", "pointer")
      .on("click", (_event, d) => onNodeClick(d as Topic))
      .call(
        d3
          .drag<SVGCircleElement, GraphNode>()
          .on("start", (event, d) => {
            if (!event.active) simulation.alphaTarget(0.3).restart();
            d.fx = d.x;
            d.fy = d.y;
          })
          .on("drag", (event, d) => {
            d.fx = event.x;
            d.fy = event.y;
          })
          .on("end", (event, d) => {
            if (!event.active) simulation.alphaTarget(0);
            d.fx = null;
            d.fy = null;
          }) as never
      );

    const label = g
      .append("g")
      .selectAll("text")
      .data(nodes)
      .join("text")
      .text((d) => (d.name.length > 22 ? d.name.slice(0, 22) + "…" : d.name))
      .attr("fill", "#E5E7EB")
      .attr("font-size", "11px")
      .attr("text-anchor", "middle")
      .attr("pointer-events", "none")
      .attr("opacity", (d) => (highlightedIds.includes(d.id) ? 1 : 0));

    node
      .on("mouseover", (_event, d) => {
        d3.selectAll<SVGTextElement, GraphNode>("text")
          .filter((n) => n.id === d.id)
          .attr("opacity", 1);
      })
      .on("mouseout", (_event, d) => {
        if (!highlightedIds.includes(d.id)) {
          d3.selectAll<SVGTextElement, GraphNode>("text")
            .filter((n) => n.id === d.id)
            .attr("opacity", 0);
        }
      });

    simulation.on("tick", () => {
      link
        .attr("x1", (d) => (d.source as GraphNode).x ?? 0)
        .attr("y1", (d) => (d.source as GraphNode).y ?? 0)
        .attr("x2", (d) => (d.target as GraphNode).x ?? 0)
        .attr("y2", (d) => (d.target as GraphNode).y ?? 0);

      node.attr("cx", (d) => d.x ?? 0).attr("cy", (d) => d.y ?? 0);
      label.attr("x", (d) => d.x ?? 0).attr("y", (d) => (d.y ?? 0) + nodeRadius(d) + 14);
    });
  }, [topics, edges, highlightedIds, onNodeClick]);

  useEffect(() => {
    draw();
  }, [draw]);

  return (
    <svg
      ref={svgRef}
      className="w-full h-full bg-gray-950 rounded-xl"
      aria-label="Topic knowledge graph"
    />
  );
}
