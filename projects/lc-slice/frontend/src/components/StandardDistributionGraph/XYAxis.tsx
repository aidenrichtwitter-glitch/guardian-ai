import { ScaleContinuousNumeric } from "d3"
import { Axis } from "./Axis"

type XYAxisProps<
  xScaleType extends ScaleContinuousNumeric<any, any, any>, 
  yScaleType extends ScaleContinuousNumeric<any, any, any>
>= {
  xScale: xScaleType,
  yScale: yScaleType,
  height: number,
  ticks: number
}

type axisSettingsType = {
  scale: ScaleContinuousNumeric<any, any, any>
  orient: "left" | "bottom"
  transform: string
  ticks?: number
}

export const XYAxis = <
  T extends ScaleContinuousNumeric<any, any, any>, 
  T2 extends ScaleContinuousNumeric<any, any, any>,
>({xScale, yScale, height, ticks}: XYAxisProps<T, T2>) => {
  const xSettings = {
    scale: xScale,
    orient: "bottom",
    transform: `translate(0, ${height})`,
  }

  const ySettings = {
    scale: yScale,
    orient: "left",
    transform: `translate(0, 0)`,
    ticks: 6,
  }

  return (
    <g className="axis-group">
      <Axis {...xSettings}/>
      <Axis {...ySettings}/>
    </g>
  )
}