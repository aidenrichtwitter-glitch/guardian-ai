type XY = {
    x: number, 
    y: number
}

export const RotatePolygonAngle = (angle: number, points: XY[]): XY[] => {
    let cosAngle = Math.cos(angle);
    let sinAngle = Math.sin(angle);

    let newPoints: XY[] = [];
    
    for (let i = 0; i < points.length; i++) {
        let new_x = points[i].x * cosAngle - points[i].y * sinAngle;
        let new_y = points[i].x * sinAngle + points[i].y * cosAngle;
        newPoints[i] = {x: new_x, y: new_y};
    }
    return newPoints;
}

export const TranslatePolygon = (x: number, y: number, points: XY[]): XY[] => {
    let newPoints: XY[] = [];
    for (let i = 0; i < points.length; i++) {
        let new_x = points[i].x + x;
        let new_y = points[i].y + y;
        newPoints[i] = {x: new_x, y: new_y}
    }
    return newPoints;
}