export type GraphNodeStateDeclarativeType= {
    hasMoved: boolean,
    isInFront: boolean,
    isBeingDragged: boolean,
    originalEventTarget: EventTarget | null,
    onMouseUpCallback: (this: any, event: MouseEvent) => any,
    onMouseMoveCallback: (this: any, event: MouseEvent) => any,
}

export type NodeDisplayType = {
    x: number,
    y: number,
    ix: number,
    iy: number,
    radius: number, 
    links: EdgeImperativeType[],
}

export type EdgeImperativeType = {
    n1Idx: number,
    n2Idx: number,
    edgeIdx: number,
    x1: number,
    x2: number,
    y1: number, 
    y2: number
}

export type NodeInteractiveType = {
    mouseStart: {
        x: number,
        y: number
    }
    nodeStart: {
        x: number, 
        y: number
    },
    node: NodeDisplayType
}