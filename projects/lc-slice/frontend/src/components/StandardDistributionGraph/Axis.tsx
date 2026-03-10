import React, {useRef, useEffect} from "react";
import {select, selectAll} from "d3-selection"
import { axisBottom, AxisDomain, axisLeft, AxisScale } from "d3-axis";
import {transition} from "d3-transition"
import { ScaleContinuousNumeric } from "d3";


type AxisProps = {
  scale: ScaleContinuousNumeric<any, any, any>
  orient: "left" | "bottom"
  transform: string
  ticks?: number
}

export const Axis = ({scale, orient, transform, ticks}: AxisProps) => {
  const axisRef = useRef<SVGGElement>(null);
  const t = transition().duration(1000);
  //On Component Mount
  useEffect(() => {
    const node = axisRef.current;

    const axis = orient === "bottom" ? axisBottom(scale) : axisLeft(scale).ticks(ticks);

    select(node).transition(t).call(axis);
  }, [])
  useEffect(() => {
    const t = transition().duration(1000);
    if (orient === "left") {
      const axis = axisLeft(scale).ticks(ticks)
      selectAll(`.${orient}`).transition(t).call(axis);
    }
  }, [scale, ticks, orient])

  return (
    <g
      ref={axisRef}
      transform={transform}
      className={`${orient} axis`}
    />
  );
}