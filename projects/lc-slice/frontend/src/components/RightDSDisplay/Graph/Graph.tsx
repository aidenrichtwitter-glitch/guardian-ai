import React, {useCallback, useEffect, useRef} from "react"
import {GraphNode} from "./GraphNode"
import {useImmer} from "use-immer"
import { useAppDispatch, useAppSelector } from "../../../features/hooks"
import {
    GraphNodeStateDeclarativeType,
    NodeDisplayType,
    EdgeImperativeType,
    NodeInteractiveType
} from "./graphTypes"

import {m} from "framer-motion"

export type GraphProps = {
    width: number,
    graphIndex: number,
}

export const Graph = ({width, graphIndex}: GraphProps) => {
    const graphNodes = useAppSelector(state => state.graphs[graphIndex].nodes);
    const nodeRadius = useAppSelector(state => state.graphs[graphIndex].nodeRadius);
    const selectedNode = useRef<number>(0);
    const edges = useRef<SVGLineElement[]>([]);
    //Ref of the entire graph
    const graphSVGRef = useRef<SVGSVGElement>(null);
    //Forwareded ref from GraphNodeObject
    const nodes = useRef<SVGGElement[]>([]);
    //We separate the state of the node from its reference, which might need to be changed in the future
    let edgeIdx = 0;
    const nodeStates = useRef<NodeInteractiveType[]>(graphNodes.map((node, idx) => {
        return {
            mouseStart: {
                x: 0, 
                y: 0
            },
            nodeStart: {
                x: 0,
                y: 0
            },
            node: {
                x: node.initX,
                y: node.initY,
                ix: node.initX, 
                iy: node.initY,
                radius: nodeRadius,
                links: node.links.map(link => {
                    let temp = {
                        n1Idx: idx,
                        n2Idx: link,
                        edgeIdx: edgeIdx,
                        x1: node.initX, 
                        y1: node.initY,
                        x2: graphNodes[link].initX, 
                        y2: graphNodes[link].initY
                    }
                    edgeIdx += 1;
                    return temp;
                })
            }
        }
    }));

    useEffect(() => {
        if (graphSVGRef.current === null) {
            return;
        }
        if (nodes.current.length !== graphNodes.length) {
            return;
        }
        //Make the Graph Node Movable...will eventually take an index to indicate which node
        if (nodes.current) {
            for (let i = 0; i < nodes.current.length; i++) {
                setMovableGraphNode(i);
            }
        }

        if (edges.current && nodeStates.current) {
            for (let i = 0; i < edges.current.length; i++) {
                const nodeIds = edges.current[i].id.split(".");
                //Get the indexes of the nodes connected by the edge
                let n1: number = parseInt(nodeIds[1]);
                let n2: number = parseInt(nodeIds[2]);
                let x1 = Number(edges.current[i].getAttribute("x1"));
                let x2 = Number(edges.current[i].getAttribute("x2"));
                let y1 = Number(edges.current[i].getAttribute("y1"));
                let y2 = Number(edges.current[i].getAttribute("y2"));
                //Assign current values to edgeState
                let edgeState: EdgeImperativeType = {
                    n1Idx: n1,
                    n2Idx: n2,
                    edgeIdx: i,
                    x1: x1,
                    x2: x2,
                    y1: y1, 
                    y2: y2,
                }

                let lengthX = x2 - x1;
                let lengthY = y2 - y1;

                //a2 + b2 etc. Thought it was dot product, lol
                let c = Math.sqrt(lengthX * lengthX + lengthY * lengthY);
                if (c === 0.0) {
                    lengthX = 0.0;
                    lengthY = 0.0;
                } else {
                    //unit vector
                    lengthX = lengthX / c;
                    lengthY = lengthY /c;
                }

                //If the first node is after the second node, negate the length
                lengthX = Math.abs (lengthX); lengthY = Math.abs (lengthY);
                if (nodeStates.current[n1].node.ix > nodeStates.current[n2].node.ix) { 
                    lengthX *= -1.0; 
                }
                if (nodeStates.current[n1].node.iy > nodeStates.current[n2].node.iy) { 
                    lengthY *= -1.0; 
                }

                let px = -lengthY;
                var py = lengthX;

                let tmpx, tmpy;
                // transform line endpoint coordinates (x1,y1) and (x2,y2) such that they are relative to the nodes when the line is horizontal (0 degrees)
                edgeState.x1 -= nodeStates.current[n1].node.x;
                edgeState.y1 -= nodeStates.current[n1].node.y;
                tmpx = edgeState.x1 * lengthX + edgeState.y1 * lengthY; 
                tmpy = edgeState.x1 * px + edgeState.y1 * py; // projection of line vector on line unit vector and perp unit vector
                edgeState.x1 = tmpx; 
                edgeState.y1 = tmpy;
                edgeState.x2 -= nodeStates.current[n2].node.x;
                edgeState.y2 -= nodeStates.current[n2].node.y;
                tmpx = edgeState.x2 * lengthX + edgeState.y2 * lengthY; 
                tmpy = edgeState.x2 * px + edgeState.y2 * py; // projection of line vector on line unit vector and perp unit vector
                edgeState.x2 = tmpx; 
                edgeState.y2 = tmpy;

                //Do something with arrow, obviously need to do matrix math here
                let halfX = 0.5 * (edgeState.x2 - edgeState.x1);
                let halfY = 0.5 * (edgeState.y2 - edgeState.y1);

                //Push the new edge state to links
                nodeStates.current[n1].node.links.push(edgeState);
                nodeStates.current[n2].node.links.push(edgeState);
            }
        }
        
        //TODO: Possible remove edge from dependency lsit
    }, [graphSVGRef, graphNodes, nodes, edges]);

    const [dragState, updateDrag] = useImmer<GraphNodeStateDeclarativeType>({
        hasMoved : false,
        isInFront: false,
        isBeingDragged: false,
        originalEventTarget: null,
        onMouseMoveCallback: (event: MouseEvent) => {
            updateDrag(state => {state.originalEventTarget = event.currentTarget});
            return moveNodeOnMouseMove(event);
        },
        onMouseUpCallback: (event: MouseEvent) => {
            updateDrag(state => {state.originalEventTarget = event.currentTarget});
            return moveNodeOnMouseUp(event);
        },
    })


    const startMove = (index: number, x: number, y: number) => {
        //Certain fields are not yet populated but will be when the callback is first called
        nodeStates.current[index].mouseStart.x = x;
        nodeStates.current[index].mouseStart.y = y;
        nodeStates.current[index].nodeStart.x = nodeStates.current[index].node.x;
        nodeStates.current[index].nodeStart.y = nodeStates.current[index].node.y;
        updateDrag(state => {state.hasMoved = false});
        updateDrag(state => {state.isInFront = false});
        updateDrag(state => {state.isBeingDragged = true});
        updateDrag(state => {state.originalEventTarget = null});
    }

    const moveNodeOnMouseMove = useCallback( (e: MouseEvent) => {
        //Get the currently selected node
        let curNode = selectedNode.current !== undefined ? selectedNode.current : 0;
        updateDrag(state => {
            state.isBeingDragged = true;
        })

        //Get new mouse coordinates
        const newMouseX = e.clientX;
        const newMouseY = e.clientY;
        updateDrag(state => {state.originalEventTarget = null});

        //If the mouse has moved from its starting position at mouse down
        if (
            newMouseX !== nodeStates.current[curNode].mouseStart.x || 
            newMouseY !== nodeStates.current[curNode].mouseStart.y) {
            //Indicate that the mouse has indeed moved
            updateDrag(state => {state.hasMoved = true})
        }

        let newNodePosX = 
            nodeStates.current[curNode].nodeStart.x + 
            newMouseX - 
            nodeStates.current[curNode].mouseStart.x
        ;

        let newNodePosY = 
            nodeStates.current[curNode].nodeStart.y +
            newMouseY - 
            nodeStates.current[curNode].mouseStart.y
        ;


        let nodeRadius = nodeStates.current[curNode].node.radius;

        //Move the node to where the node object lay + (new position of mouse - where the mouse started)
        nodeStates.current[curNode].node.x = newNodePosX;
        nodeStates.current[curNode].node.y = newNodePosY;

        //Account for the node's initial position before applying a translation
        let prevIX = nodeStates.current[curNode].node.ix
        let prevIY = nodeStates.current[curNode].node.iy
        let x = newNodePosX - prevIX;
        let y = newNodePosY - prevIY;
        nodes.current[curNode].setAttribute("transform", "translate(" + (x) + "," + (y) + ")")

        //Now modify the edges between nodes

        for (let i = 0; i < nodeStates.current[curNode].node.links.length; i++) {
            //Get the indexes of the nodes referred to in the current link of the current node
            let n1: number = nodeStates.current[curNode].node.links[i].n1Idx;
            let n2: number = nodeStates.current[curNode].node.links[i].n2Idx;
            let edgeIndex: number = nodeStates.current[curNode].node.links[i].edgeIdx;

            //Get the affected nodes
            let nodeOne: NodeDisplayType = nodeStates.current[n1].node;
            let nodeTwo: NodeDisplayType = nodeStates.current[n2].node;
            //Get their current positions
            let x1 = nodeStates.current[n1].node.x;
            let x2 = nodeStates.current[n2].node.x;
            let y1 = nodeStates.current[n1].node.y;
            let y2 = nodeStates.current[n2].node.y;

            //Get new x and y lengths
            let lengthX = nodeTwo.x - nodeOne.x;
            let lengthY = nodeTwo.y - nodeOne.y;
            let c = (lengthX * lengthX + lengthY * lengthY);
            if (c === 0.0) {
                lengthX = 0.0; lengthY = 0.0;
            } else {
                lengthX = lengthX / c;
                lengthY = lengthY / c;
            }

            let px = -lengthY;
            let py = lengthX;

            let newX1 = nodeOne.x + lengthX * x1 + px * y1;
            let newY1 = nodeOne.y + lengthY * x1 + py * y1;
            let newX2 = nodeTwo.x + lengthX * x2 + px * y2;
            let newY2 = nodeTwo.y + lengthY * x2 + py * y2;

            //The node positions won't be updated dynamically
            if (edges.current[edgeIndex]) {
                //Set edge position to Node1 position + unitVector * old position
                //nodeStates.current[curNode].node.links[i].x1 = newX1;
                //nodeStates.current[curNode].node.links[i].x2 = newX2;
                //nodeStates.current[curNode].node.links[i].y1 = newY1;
                //nodeStates.current[curNode].node.links[i].y2 = newY2;
                edges.current[edgeIndex].setAttribute("x1", (newX1).toString());
                edges.current[edgeIndex].setAttribute("y1", (newY1).toString());
                edges.current[edgeIndex].setAttribute("x2", (newX2).toString());
                edges.current[edgeIndex].setAttribute("y2", (newY2).toString());
            }

        }
        return false;
    }, [width])

    const moveNodeOnMouseUp = (e: MouseEvent) => {
        const curNode = selectedNode.current
        //Node is no longer being dragged
        updateDrag(state => {state.isBeingDragged = false});
        nodeStates.current[curNode].node.radius = nodeStates.current[curNode].node.radius / 1.5;;

        document.removeEventListener("mousemove", dragState.onMouseMoveCallback, false);
        document.removeEventListener("mouseup", dragState.onMouseUpCallback, false);
        return false;
    }

    //TODO: Mouse Event or React.MouseEvent
    const moveNodeOnMouseDown = (e: MouseEvent, index: number) => {
        console.log("Mouse down on node")
        selectedNode.current = index;
        startMove(index, e.clientX, e.clientY);
        nodeStates.current[index].node.radius = nodeStates.current[index].node.radius * 1.5;
        document.addEventListener("mousemove", dragState.onMouseMoveCallback, false);
        document.addEventListener("mouseup", dragState.onMouseUpCallback, false);
        return false;
    }

    const setMovableGraphNode = (index: number) => {
        //Do nothing if the ref is null
        if (nodes.current[index] !== undefined) {
            nodes.current[index].onmousedown = (event) => moveNodeOnMouseDown(event, index);
        } else{
            return;
        } 
    }

    return (
        <div>
          Drag the Nodes in the Display.
            <m.svg 
                ref={graphSVGRef} 
                xmlns="http://www.w3.org/2000/svg" 
                xmlnsXlink={"http://www.w3.org/1999/xlink"} 
                className="notselectable nwlinkhovertoggle" 
                height="900" id="svg_network_image" width={width} style={{verticalAlign: "top"}}
            >
                <g id="edges">
                    <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="20" refY="3.5" orient="auto">
                            <polygon points="0 0, 10 3.5, 0 7" />
                    </marker>
                    <marker id="arrowhead_reverse" markerWidth="10" markerHeight="7" refX="-10" refY="3.5" orient="auto"  fill="red" >
                        <polygon points="10 0, 10 7, 0 3.5" fill="black"/>
                    </marker>
                    {/*TODO: THIS METHOD ONLY WORKS FOR SINGLE DIRECTION LINES*/}
                    {graphNodes.map((node, nodeIdx) => (
                        node.links.map((link, linkIdx) => (
                            <line key={`GRAPH_${graphIndex}_LINE_FROM_NODE_${nodeIdx}_TO_${link}`}xmlns="http://www.w3.org/2000/svg" 
                                ref={(ref) => {
                                    if (ref !== null) {
                                        edges.current.push(ref)
                                    }
                                }}
                                className="nw_edge" 
                                id={`line.${nodeIdx}.${link}.0` }
                                stroke="rgb(0,0,200)" 
                                markerEnd="url(#arrowhead)"
                                markerStart="url(#arrowhead_reverse)"
                                strokeOpacity="1" strokeWidth={"5"} x1={node.initX} x2={graphNodes[link].initX} y1={node.initY} y2={graphNodes[link].initY}/>
                        ))
                    ))}

                </g>
                <g id="nodes">
                    <defs>
                        <filter id="filter_shadow">
                            <feGaussianBlur stdDeviation="1"/>
                        </filter>
                    </defs>
                    <defs>
                        <filter height="200%" id="filter_bg_text" width="200%" x="-50%" y="-50%">
                            <feGaussianBlur stdDeviation="1.8"/>
                        </filter>
                    </defs>
                    

                    {graphNodes.map((node, idx) => (
                        <GraphNode key={node.name}
                            graphIndex={graphIndex}
                            nodeId={idx}
                            startX={node.initX}
                            startY={node.initY}
                            radius={nodeRadius}
                            ref={(ref) => {
                                if (ref !== null) { 
                                    nodes.current.push(ref)
                                }
                            }}
                        />
                    ))}
                </g>
            </m.svg>     
        </div>
    );
}