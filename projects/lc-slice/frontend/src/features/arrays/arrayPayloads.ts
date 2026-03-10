export interface ArrayIndexPL {
    arrayIndex: number
}

export interface DataPL {
    data: any[]
}

export interface PushDataPayload extends ArrayIndexPL, DataPL {}

export interface PopDataPayload extends ArrayIndexPL {
    num: number,
}

export interface PushDataAtIndexPayload extends ArrayIndexPL, DataPL {
    index: number,
    replaceAtIndex: boolean
}

export interface RemoveIndexAtPayload extends ArrayIndexPL {
    index: number,
}

export interface AddPointerPayload extends ArrayIndexPL {
    location?: number
}

export interface DeletePointerPayload extends ArrayIndexPL {
    pointerIndex?: number
}

export interface MovePointerPayload extends ArrayIndexPL {
    pointerIndex: number, 
    newLocation: number
}
