"use client";

import type { EChartsOption } from "echarts";
import { useEffect, useMemo, useRef } from "react";

import type {
  MarketQuote,
  WeatherPoint,
} from "@/components/display/types";

const ZONE = "Europe/Zurich";
const dayFormatter = new Intl.DateTimeFormat("de-CH", {
  timeZone: ZONE,
  weekday: "short",
});
const dateFormatter = new Intl.DateTimeFormat("de-CH", {
  timeZone: ZONE,
  day: "2-digit",
  month: "2-digit",
});

function EChart({
  option,
  className,
  label,
}: {
  option: EChartsOption;
  className: string;
  label: string;
}) {
  const container = useRef<HTMLDivElement>(null);
  const chart = useRef<import("echarts").ECharts | null>(null);
  const latestOption = useRef(option);

  useEffect(() => {
    latestOption.current = option;
  }, [option]);

  useEffect(() => {
    let disposed = false;
    let resizeObserver: ResizeObserver | null = null;

    void import("echarts").then((echarts) => {
      if (disposed || !container.current) return;
      chart.current = echarts.init(container.current, undefined, {
        renderer: "canvas",
        devicePixelRatio: Math.min(window.devicePixelRatio, 2),
      });
      chart.current.setOption(latestOption.current);
      resizeObserver = new ResizeObserver(() => chart.current?.resize());
      resizeObserver.observe(container.current);
    });

    return () => {
      disposed = true;
      resizeObserver?.disconnect();
      chart.current?.dispose();
      chart.current = null;
    };
  }, []);

  useEffect(() => {
    chart.current?.setOption(option, { notMerge: true });
  }, [option]);

  return (
    <div
      className={className}
      ref={container}
      role="img"
      aria-label={label}
    />
  );
}

export function WeatherForecastChart({
  points,
}: {
  points: WeatherPoint[];
}) {
  const option = useMemo<EChartsOption>(() => {
    const days = points.map((point) =>
      dayFormatter.format(new Date(`${point.date}T12:00:00Z`)),
    );
    return {
      animationDuration: 900,
      animationEasing: "cubicOut",
      grid: { top: 20, right: 12, bottom: 30, left: 8, containLabel: true },
      tooltip: {
        trigger: "axis",
        backgroundColor: "rgba(255, 250, 241, 0.96)",
        borderColor: "rgba(126, 92, 62, 0.18)",
        textStyle: { color: "#40362f", fontWeight: 600 },
        formatter: (items) => {
          const rows = Array.isArray(items) ? items : [items];
          const index = Number(rows[0]?.dataIndex ?? 0);
          const point = points[index];
          if (!point) return "";
          const rain = point.precipitationProbabilityPercent;
          return [
            `<strong>${days[index]}</strong>`,
            `Höchstwert&nbsp;&nbsp;${Math.round(point.temperatureMaxCelsius)}°`,
            `Tiefstwert&nbsp;&nbsp;${Math.round(point.temperatureMinCelsius)}°`,
            `Regen&nbsp;&nbsp;${rain === null ? "–" : `${Math.round(rain)} %`}`,
          ].join("<br/>");
        },
      },
      xAxis: {
        type: "category",
        boundaryGap: false,
        data: days,
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: {
          color: "#796b61",
          fontSize: 11,
          fontWeight: 700,
          margin: 14,
        },
      },
      yAxis: [
        {
          type: "value",
          scale: true,
          splitNumber: 3,
          axisLabel: { show: false },
          axisLine: { show: false },
          axisTick: { show: false },
          splitLine: {
            lineStyle: { color: "rgba(126, 92, 62, 0.1)", type: "dashed" },
          },
        },
        {
          type: "value",
          min: 0,
          max: 100,
          axisLabel: { show: false },
          axisLine: { show: false },
          axisTick: { show: false },
          splitLine: { show: false },
        },
      ],
      series: [
        {
          name: "Regen",
          type: "bar",
          yAxisIndex: 1,
          data: points.map(
            (point) => point.precipitationProbabilityPercent ?? 0,
          ),
          barWidth: "36%",
          itemStyle: {
            color: "rgba(77, 151, 184, 0.2)",
            borderRadius: [8, 8, 2, 2],
          },
          emphasis: { disabled: true },
          z: 1,
        },
        {
          name: "Maximum",
          type: "line",
          smooth: 0.42,
          symbol: "circle",
          symbolSize: 9,
          data: points.map((point) => point.temperatureMaxCelsius),
          lineStyle: { color: "#c96f4a", width: 4, cap: "round" },
          itemStyle: {
            color: "#fffaf1",
            borderColor: "#c96f4a",
            borderWidth: 3,
          },
          areaStyle: {
            color: {
              type: "linear",
              x: 0,
              y: 0,
              x2: 0,
              y2: 1,
              colorStops: [
                { offset: 0, color: "rgba(229, 151, 92, 0.38)" },
                { offset: 1, color: "rgba(229, 151, 92, 0.02)" },
              ],
            },
          },
          z: 3,
        },
        {
          name: "Minimum",
          type: "line",
          smooth: 0.42,
          symbol: "circle",
          symbolSize: 7,
          data: points.map((point) => point.temperatureMinCelsius),
          lineStyle: { color: "#5a92a7", width: 3, cap: "round" },
          itemStyle: {
            color: "#fffaf1",
            borderColor: "#5a92a7",
            borderWidth: 2,
          },
          z: 4,
        },
      ],
    };
  }, [points]);

  return (
    <div className="forecast-chart-shell">
      <div className="forecast-chart__legend">
        <span><i data-tone="high" />Maximum</span>
        <span><i data-tone="low" />Minimum</span>
        <span><i data-tone="rain" />Regenrisiko</span>
      </div>
      <EChart
        className="forecast-chart"
        label="Temperatur- und Regenprognose"
        option={option}
      />
      <div className="forecast-chart__icons" aria-hidden="true">
        {points.map((point) => (
          <span key={point.date}>
            {Math.round(point.temperatureMaxCelsius)}° /{" "}
            {Math.round(point.temperatureMinCelsius)}°
          </span>
        ))}
      </div>
    </div>
  );
}

export function MarketPriceChart({ quote }: { quote: MarketQuote }) {
  const positive = (quote.changePercent ?? 0) >= 0;
  const color = positive ? "#4f8060" : "#bd604f";
  const fill = positive ? "rgba(103, 143, 108, " : "rgba(194, 102, 82, ";
  const option = useMemo<EChartsOption>(
    () => ({
      animationDuration: 1100,
      animationEasing: "cubicOut",
      grid: { top: 16, right: 5, bottom: 18, left: 5 },
      tooltip: {
        trigger: "axis",
        backgroundColor: "rgba(255, 250, 241, 0.96)",
        borderColor: "rgba(126, 92, 62, 0.18)",
        textStyle: { color: "#40362f", fontWeight: 650 },
        formatter: (items) => {
          const rows = Array.isArray(items) ? items : [items];
          const index = Number(rows[0]?.dataIndex ?? 0);
          const point = quote.history[index];
          return point
            ? `${dateFormatter.format(new Date(point.at))}<br/><strong>${point.value.toLocaleString("de-CH", { maximumFractionDigits: 2 })} ${quote.currency}</strong>`
            : "";
        },
      },
      xAxis: {
        type: "category",
        boundaryGap: false,
        data: quote.history.map((point) => point.at),
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: { show: false },
      },
      yAxis: {
        type: "value",
        scale: true,
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: { show: false },
        splitLine: {
          lineStyle: { color: "rgba(126, 92, 62, 0.09)", type: "dashed" },
        },
      },
      series: [{
        type: "line",
        data: quote.history.map((point) => point.value),
        smooth: 0.38,
        showSymbol: false,
        lineStyle: { color, width: 4, cap: "round" },
        itemStyle: { color },
        areaStyle: {
          color: {
            type: "linear",
            x: 0,
            y: 0,
            x2: 0,
            y2: 1,
            colorStops: [
              { offset: 0, color: `${fill}0.4)` },
              { offset: 1, color: `${fill}0.01)` },
            ],
          },
        },
      }],
    }),
    [color, fill, quote.currency, quote.history],
  );

  if (quote.history.length < 2) {
    return <div className="market-chart market-chart--empty">Keine Kursreihe</div>;
  }

  return (
    <EChart
      className="market-chart"
      label={`Kursverlauf von ${quote.symbol}`}
      option={option}
    />
  );
}
