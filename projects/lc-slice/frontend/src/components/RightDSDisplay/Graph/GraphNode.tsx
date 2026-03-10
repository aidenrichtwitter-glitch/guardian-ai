import React from "react"
import {motion} from "framer-motion"
import { useAppSelector } from "../../../features/hooks"


export type GraphNodeProps = {
    startX: number,
    startY: number,
    radius: number,
    nodeId: number,
    graphIndex: number,
}


export const GraphNode = React.forwardRef<SVGGElement, GraphNodeProps>((props, ref) => {
    const {graphIndex, startX, startY, radius, nodeId} = props;

    const nodeData = useAppSelector(state => state.graphs[graphIndex].nodes[nodeId].data)
    
    return (
        <g ref={ref} className="graph_node" data-action_option="add" data-exp_height={radius.toString()} data-exp_width="324" data-radius={40} data-safe_div_label="desF" data-x_pos={startX.toString()} data-y_pos={startY.toString()} id={`node.${nodeId}`}>
            <ellipse cx={startX.toString()} cy={(startY + 9).toString()} fill="#000000" filter="url(#filter_shadow)" opacity="0.6" rx={(radius - 1).toString()} ry={(radius - 6).toString()}/>
            <circle r={radius.toString()} cx={startX.toString()} cy={startY.toString()} fill="url(#bubble_gradient1)">
            </circle>
            <circle className="nwbubblecoloredcircle" cx={startX.toString()} cy={startY.toString()} fill="rgb(255,255,255)" r={radius.toString()}>
            </circle>
            <ellipse cx={startX.toString()} cy={(startY - 12).toString()} fill="url(#brilliance_gradient)" rx="31.5" ry="20"/>
            <text fill="rgb(0,0,0)" opacity="1.0" textAnchor="start" x={
                (startX - (5 * nodeData.toString().length)).toString()
            } y={
                (startY + 5).toString() 
            }>{nodeData}</text>
        </g>
    );
})