import React, { useRef, useEffect, useMemo, useState, useCallback} from "react";
import * as d3 from "d3";
import { curveMonotoneX } from "d3";
import { extent } from "d3";
import "./sdg.scss"



let lastRun: number;
let fps: number;


export const useD3 = (renderChartFn: any, dependencies: any) => {
  const ref = useRef<SVGSVGElement>(null);
  useEffect(() => {
    renderChartFn(d3.select(ref.current));
    return () => {};
  }, dependencies)
  return ref;
}

type DataType = {
  x: number, y: number
}

type SDGProps = {
  mean: number, 
  standardDeviation: number,
  fidelity: number,
  xLabel: string,
  spanInDeviations: number
}


//https://www.probabilitycourse.com/chapter4/4_2_3_normal.php



/* lowEnd: Beginning x-Value, which is an n standard deviations behind the center
/* highEnd: Ending x-value, n standard deviations in front of center
/* meanValue: mean of standard distribution curve
/* standardDeviation: obvious
/* fidelity: Number of step to take along the x-axis
*/ 
const generateProbabilityDensityData = (
  lowEnd: number,
  highEnd: number,
  meanValue: number, 
  standardDeviation: number,
  fidelity: number,
): [number, number][] => {
  // High end is four standard deviations away from mean
  // low end is four standard deviations backwards
  const span = highEnd - lowEnd;
  const data: [number, number][] = [];
  for (let i = 0; i <= fidelity; i++) {
    const xStep = lowEnd + (span * i/fidelity);
    // Espoused formula for PDF
    const variance = standardDeviation * standardDeviation;
    const testVal = xStep - meanValue;
    const exponentNumerator = testVal * testVal * -1;
    const exponentDenominator = 2 * variance;
    const exponent = exponentNumerator / exponentDenominator;
    const expValue = Math.pow(Math.E, exponent);
    const yStep = parseFloat((expValue / (Math.sqrt(2 * Math.PI) * standardDeviation)).toFixed(3));
    data.push([xStep, yStep]);
  }
  return data;
}



const getTicks = (count: number, max: number) => {
  return [...Array(count).keys()].map(d => {
    return (max / (count - 1) * d).toFixed(2);
  });
}

const getTicksFromSpan = (
  tickCount: number, 
  low: number, 
  high: number
) => {
  const arr = [];
  for (let i = 0; i <= tickCount; i++) {
    const val = low + (high - low) * (i/tickCount)
    arr.push(parseFloat(val.toFixed(2)));
  }
  return arr;
}


export const StandardDistributionGraph = ({
  mean, 
  standardDeviation, 
  fidelity, 
  xLabel,
  spanInDeviations
}: SDGProps) => {
  const low = mean - (spanInDeviations * standardDeviation);
  const high = mean + (spanInDeviations * standardDeviation);
  const cachedData: [number, number][] = generateProbabilityDensityData(low, high, mean, standardDeviation, fidelity);

  const width = 800;
  const height = 300;
  const svgHeight = 300 + 20;

  /* Animation properties */
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const requestIdRef = useRef<number | null>(null);
  const initialFidelityRef = useRef<number | null>(10);
  const getCanvasWithContext = (canvas = canvasRef.current) => {
    return {canvas, context: canvas?.getContext("2d")};
  }

  const draw = () => {
    const {canvas, context} = getCanvasWithContext();
    if (!canvas || !context) {
      return;
    }
    if (!initialFidelityRef.current || initialFidelityRef.current >= fidelity) {
      return;
    }
    initialFidelityRef.current += 1;

    context.clearRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = "gray";
    context.clearRect(0, 0, canvas.width, canvas.height);

    context.strokeStyle = "red";
    context.lineWidth = 3;
    context.beginPath();
    context.moveTo(cachedData[0][0], cachedData[0][1]);
    for (let i = 1; i <= initialFidelityRef.current - 1; i++) {
      const newIndex = Math.floor(fidelity / initialFidelityRef.current - 1) * i;
      console.log(newIndex)
      context.lineTo(cachedData[newIndex][0], cachedData[newIndex][1]);
    }
    context.stroke();
    if (initialFidelityRef.current < fidelity) {
      requestAnimationFrame(() => draw())
    }
  }


  const TICK_COUNT = 10;

  let MAX_X = Math.max(...cachedData.map(d => d[0]));
  let MAX_Y = Math.max(...cachedData.map(d => d[1]));

  let getPixelX = (val: number) => (val / MAX_X) * width;
  let getPixelY = (val: number) => {
    console.log((val / MAX_Y) * height);
    return height - (val / MAX_Y) * height;
  }

  useEffect(() => {
    requestAnimationFrame(() => draw())
  }, [])

  /*useEffect(() => {
    requestAnimationFrame(() => draw())
  }, [spanInDeviations, initialFidelityRef.current, fidelity,mean, standardDeviation]) */

  let x_ticks = getTicksFromSpan(TICK_COUNT, low, high);
  let y_ticks = getTicks(TICK_COUNT, MAX_Y).reverse();

  return (
    <div className="line_chart" 
      style={{
        width: `${width}px`,
        height: `${height}px`
      }}
    >
      <canvas ref={canvasRef} width={width} height={svgHeight}></canvas>
      <div className="x_axis">
        {x_ticks.map(v => <div data-value={v}/>)}
      </div>
      <div className="y_axis">
        {y_ticks.map(v => <div data-value={v}/>)}
      </div>
    </div>
  );
}

/*export const StandardDistributionGraph = ({mean, standardDeviation, fidelity, xLabel}: SDGProps) => {
  const cachedData: [number, number][] = useMemo(() => {
    const low = mean - (4 * standardDeviation);
    const high = mean + (4 * standardDeviation);
    return generateProbabilityDensityData(low, high, mean, standardDeviation, fidelity);
  }, [mean, standardDeviation]);

  let dummyData: number[][] = [
    [0, 10],
    [5, 50],
    [15, 75],
    [55, 100],
    [75, 10],
    [100, 5]
  ]

  let xScale = d3
    .scaleLinear()
    .domain(extent(dummyData.map((data) => data[0]), d=
    .range([0, 300])

  let line = d3.line()
    .x((d) => xScale(d[0]))
    .y(d => 300 - d[1])
    .curve(curveMonotoneX)
  let d = line(cachedData);


  return */

  /*return (
    <div style={{display: "flex", "justifyContent": "center", "width": "100%", height: "100%"}}>
      <svg width={"300"} height={"300"} viewBox="0 0 300 300">
        <path d={d ? d : undefined} fill="none" stroke="black"></path>
      </svg>
    </div>
  ) 
} */

/*const margins = {
    top: 20,
    right: 20,
    bottom: 20,
    left: 20,
  }

  const parentWidth = 500;
  const parentHeight = 200;
  const width = parentWidth - margins.left - margins.right;
  const height = parentHeight - margins.top - margins.bottom;

  const ticks = 6;

  const xScale = d3.scaleLinear()
    .domain(cachedData.map(data => data.x))
    .range([0, width]);

  const yScale = d3.scaleLinear()
    .domain(cachedData.map(data => data.y))
    .range([0, height]);

  const lineGenerator = d3.line()
    .x(data => {
      console.log(data)
      return xScale(data[0])
    })
    .y(data => {
      console.log(data)
      return yScale(data[1])
    })
    .curve(curveMonotoneX);

  return (
    <div className="sdg_container">
      <svg 
        className="standard_deviation_svg"
        width={width + margins.left + margins.right}
        height={height + margins.top + margins.bottom}
      >
        <g transform={`translate(${margins.left}, ${margins.top})`}>
          <XYAxis {...{xScale, yScale, height, ticks}}/>

        </g>
      </svg>
    </div>
  ) */