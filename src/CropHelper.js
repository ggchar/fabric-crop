import { fabric } from "fabric";

export const initCrop = (img, canvas, options) => {
  let cropRectOptions = {
    id: "crop-rect",
    top: img.top,
    left: img.left,
    angle: img.angle,
    width: img.getScaledWidth(),
    height: img.getScaledHeight(),
    strokeWidth: 0,
    strokeUniform: true,
    cornerColor: "rgba(23,101,240,0.5)",
    cornerStrokeColor: "rgba(23,101,240,0.5)",
    padding: 0,
    borderDashArray: [5, 2],
    fill: "rgba(255, 255, 255, 1)",
    globalCompositeOperation: "overlay",
    lockRotation: true,
  };

  let overlayRectOptions = {
    id: "overlay-rect",
    top: img.top,
    left: img.left,
    angle: img.angle,
    width: img.getScaledWidth(),
    height: img.getScaledHeight(),
    selectable: false,
    selection: false,
    fill: "rgba(0, 0, 0, 0.5)",
    lockRotation: true,
  };

  let okButtonOptions = {
    icon: defalutApplyIcon,
    iconSize: 24,
    x: 0.5,
    y: -0.5,
    offsetY: -16,
    offsetX: -50,
    cursorStyle: "pointer",
    cornerSize: 24,
  };

  let cancelButtonOptions = {
    icon: defalutCancelIcon,
    iconSize: 24,
    x: 0.5,
    y: -0.5,
    offsetY: -16,
    offsetX: -20,
    cursorStyle: "pointer",
    cornerSize: 24,
  };

  let imageLoader = loadFromURL;

  if (options) {
    if (options.cropRect) {
      cropRectOptions = { ...cropRectOptions, ...options.cropRect };
    }
    if (options.overlayRect) {
      overlayRectOptions = {
        ...overlayRectOptions,
        ...options.overlayRect,
      };
    }
    if (options.okButton) {
      okButtonOptions = {
        ...okButtonOptions,
        ...options.okButton,
      };
    }
    if (options.cancelButton) {
      cancelButtonOptions = {
        ...cancelButtonOptions,
        ...options.cancelButton,
      };
    }
    if (options.imageLoader) {
      imageLoader = options.imageLoader;
    }
  }

  var cropRect = new fabric.Rect(cropRectOptions);

  cropRect.setControlVisible("mtr", false);

  var overlayRect = new fabric.Rect(overlayRectOptions);
  canvas.add(overlayRect);

  var s = img.cropX,
    o = img.cropY,
    c = img.width,
    l = img.height;

  cropRect.set({
    left: img.left + s * img.scaleX,
    top: img.top + o * img.scaleY,
    width: c * img.scaleX,
    height: l * img.scaleY,
    dirty: false,
    initLeft: img.left + s * img.scaleX,
    initTop: img.top + o * img.scaleY,
  });

  cropRect.oldScaleX = cropRect.scaleX;
  cropRect.oldScaleY = cropRect.scaleY;

  canvas.add(cropRect);
  canvas.discardActiveObject();
  canvas.setActiveObject(cropRect);

  if (!cropRect.canvas) cropRect.canvas = canvas;

  // Add an Apply button to the crop box.
  createButton(
    cropRect,
    "applyControl",
    () => {
      applyCrop(cropRect, img, canvas, imageLoader);
    },
    okButtonOptions
  );

  // Add an Cancel button to the crop box.
  createButton(
    cropRect,
    "cancelControl",
    () => {
      cancelCrop(cropRect, overlayRect, img, canvas);
    },
    cancelButtonOptions
  );

  canvas.renderAll();
  cropRect.originOCoords = cropRect.oCoords;

  cropRect.on("moving", function (event) {
    // Determine whether all four vertices of rectangle B are inside rectangle A.
    const target = event.transform.target;
    const originOCoords = target.originOCoords;

    // The coordinates of the bottom-left vertex when the crop box is at the bottom-right corner.
    const maxBl = getPointOnline(
      originOCoords.bl,
      originOCoords.br,
      target.width * target.scaleX
    );

    // The coordinates of the top-right vertex when the crop box is at the bottom-right corner.
    const maxTr = getPointOnline(
      originOCoords.tr,
      originOCoords.br,
      target.height * target.scaleY
    );

    // The coordinates of the top-left vertex of the rectangle within which the crop box vertices can move.
    const rectTl = originOCoords.tl;

    // The coordinates of the top-right vertex of the rectangle within which the crop box vertices can move.
    const rectTr = projectPointOntoSegment(
      originOCoords.tl,
      originOCoords.tr,
      maxBl
    );

    // The coordinates of the bottom-left vertex of the rectangle within which the crop box vertices can move.
    const rectBl = projectPointOntoSegment(
      originOCoords.tl,
      originOCoords.bl,
      maxTr
    );

    // The coordinates of the bottom-right vertex of the rectangle within which the crop box vertices can move.
    const rectBr = findIntersection(rectBl, maxTr, rectTr, maxBl);

    const targetTopLeft = { x: target.left, y: target.top };

    const widthSide = isPointOnSameSideOfLines(
      rectTl,
      rectBl,
      rectTr,
      rectBr,
      targetTopLeft
    );
    const heightSide = isPointOnSameSideOfLines(
      rectTl,
      rectTr,
      rectBl,
      rectBr,
      targetTopLeft
    );

    /*
                 |         |
            1,2  |  0,2    | 2,2
        ---------------------------
                 |         |
            1,0  |  0,0    | 2,0
        ---------------------------
                 |         |
            1,1  |  0,1    | 2,1

    */

    if (widthSide > 0 || heightSide > 0) {
      let newTop = target.top;
      let newLeft = target.left;

      if (widthSide === 1 && heightSide === 2) {
        newLeft = rectTl.x;
        newTop = rectTl.y;
      } else if (widthSide === 2 && heightSide === 2) {
        newLeft = rectTr.x;
        newTop = rectTr.y;
      } else if (widthSide === 2 && heightSide === 1) {
        newLeft = rectBr.x;
        newTop = rectBr.y;
      } else if (widthSide === 1 && heightSide === 1) {
        newLeft = rectBl.x;
        newTop = rectBl.y;
      } else if (widthSide === 0 && heightSide === 2) {
        const projectionTl = projectPointOntoSegment(
          rectTl,
          rectTr,
          targetTopLeft
        );
        newLeft = projectionTl.x;
        newTop = projectionTl.y;
      } else if (widthSide === 2 && heightSide === 0) {
        const projectionTl = projectPointOntoSegment(
          rectTr,
          rectBr,
          targetTopLeft
        );
        newLeft = projectionTl.x;
        newTop = projectionTl.y;
      } else if (widthSide === 0 && heightSide === 1) {
        const projectionTl = projectPointOntoSegment(
          rectBl,
          rectBr,
          targetTopLeft
        );
        newLeft = projectionTl.x;
        newTop = projectionTl.y;
      } else if (widthSide === 1 && heightSide === 0) {
        const projectionTl = projectPointOntoSegment(
          rectTl,
          rectBl,
          targetTopLeft
        );
        newLeft = projectionTl.x;
        newTop = projectionTl.y;
      }

      cropRect.set({
        left: newLeft,
        top: newTop,
      });
    }
  });

  cropRect.on("scaling", function (event) {
    const target = event.transform.target;
    const corner = event.transform.corner;

    const originOCoords = cropRect.originOCoords;
    const oCoords = cropRect.oCoords;
    if (corner === "ml" || corner === "mr") {
      if (event.transform.signX < 0) {
        // left
        const intersection = findIntersection(
          originOCoords.tl,
          originOCoords.bl,
          oCoords.tl,
          oCoords.tr
        );
        const maxWidth = calculateDistance(intersection, oCoords.tr);
        const maxScaleX = maxWidth / target.width;
        if (target.scaleX > maxScaleX) {
          cropRect.set({
            left: intersection.x,
            top: intersection.y,
            scaleX: maxScaleX,
          });
        }
      } else {
        // right
        const intersection = findIntersection(
          originOCoords.tr,
          originOCoords.br,
          oCoords.tl,
          oCoords.tr
        );
        const maxWidth = calculateDistance(intersection, oCoords.tl);
        const maxScaleX = maxWidth / target.width;
        if (target.scaleX > maxScaleX) {
          cropRect.set({
            scaleX: maxScaleX,
          });
        }
      }
    } else if (corner === "mt" || corner === "mb") {
      if (event.transform.signY < 0) {
        // top
        const intersection = findIntersection(
          originOCoords.tl,
          originOCoords.tr,
          oCoords.tl,
          oCoords.bl
        );
        const maxHeight = calculateDistance(intersection, oCoords.bl);
        const maxScaleY = maxHeight / target.height;
        if (target.scaleY > maxScaleY) {
          cropRect.set({
            left: intersection.x,
            top: intersection.y,
            scaleY: maxScaleY,
          });
        }
      } else {
        // bottom
        const intersection = findIntersection(
          originOCoords.bl,
          originOCoords.br,
          oCoords.tl,
          oCoords.bl
        );
        const maxHeight = calculateDistance(intersection, oCoords.tl);
        const maxScaleY = maxHeight / target.height;
        if (target.scaleY > maxScaleY) {
          cropRect.set({
            scaleY: maxScaleY,
          });
        }
      }
    } else {
      if (event.transform.signX < 0) {
        if (event.transform.signY < 0) {
          // top left
          const maxScaleX =
            distanceFromPointToLine(
              oCoords.br,
              originOCoords.tl,
              originOCoords.bl
            ) / target.width;
          const maxScaleY =
            distanceFromPointToLine(
              oCoords.br,
              originOCoords.tl,
              originOCoords.tr
            ) / target.height;

          if (target.scaleX > maxScaleX && target.scaleY > maxScaleY) {
            cropRect.set({
              left: originOCoords.tl.x,
              top: originOCoords.tl.y,
              scaleX: maxScaleX,
              scaleY: maxScaleY,
            });
          } else if (target.scaleX > maxScaleX) {
            const intersection = findIntersection(
              originOCoords.tl,
              originOCoords.bl,
              oCoords.tl,
              oCoords.tr
            );
            const scaleY =
              calculateDistance(oCoords.tr, oCoords.br) / target.height;
            cropRect.set({
              left: intersection.x,
              top: intersection.y,
              scaleX: maxScaleX,
              scaleY: scaleY,
            });
          } else if (target.scaleY > maxScaleY) {
            const intersection = findIntersection(
              originOCoords.tl,
              originOCoords.tr,
              oCoords.tl,
              oCoords.bl
            );
            const scaleX =
              calculateDistance(oCoords.bl, oCoords.br) / target.width;
            cropRect.set({
              left: intersection.x,
              top: intersection.y,
              scaleX: scaleX,
              scaleY: maxScaleY,
            });
          }
        } else {
          // bottom left
          const maxScaleX =
            distanceFromPointToLine(
              oCoords.tr,
              originOCoords.tl,
              originOCoords.bl
            ) / target.width;
          const maxScaleY =
            distanceFromPointToLine(
              oCoords.tr,
              originOCoords.bl,
              originOCoords.br
            ) / target.height;

          if (target.scaleX > maxScaleX && target.scaleY > maxScaleY) {
            const intersection = findIntersection(
              originOCoords.tl,
              originOCoords.bl,
              oCoords.tl,
              oCoords.tr
            );

            cropRect.set({
              left: intersection.x,
              top: intersection.y,
              scaleX: maxScaleX,
              scaleY: maxScaleY,
            });
          } else if (target.scaleX > maxScaleX) {
            const intersection = findIntersection(
              originOCoords.tl,
              originOCoords.bl,
              oCoords.tl,
              oCoords.tr
            );

            cropRect.set({
              left: intersection.x,
              top: intersection.y,
              scaleX: maxScaleX,
            });
          } else if (target.scaleY > maxScaleY) {
            cropRect.set({
              scaleY: maxScaleY,
            });
          }
        }
      } else {
        if (event.transform.signY < 0) {
          // top right
          const maxScaleX =
            distanceFromPointToLine(
              oCoords.bl,
              originOCoords.tr,
              originOCoords.br
            ) / target.width;
          const maxScaleY =
            distanceFromPointToLine(
              oCoords.bl,
              originOCoords.tl,
              originOCoords.tr
            ) / target.height;

          if (target.scaleX > maxScaleX && target.scaleY > maxScaleY) {
            const intersection = findIntersection(
              originOCoords.tl,
              originOCoords.tr,
              oCoords.tl,
              oCoords.bl
            );

            cropRect.set({
              left: intersection.x,
              top: intersection.y,
              scaleX: maxScaleX,
              scaleY: maxScaleY,
            });
          } else if (target.scaleX > maxScaleX) {
            cropRect.set({
              scaleX: maxScaleX,
            });
          } else if (target.scaleY > maxScaleY) {
            const intersection = findIntersection(
              originOCoords.tl,
              originOCoords.tr,
              oCoords.tl,
              oCoords.bl
            );
            cropRect.set({
              left: intersection.x,
              top: intersection.y,
              scaleY: maxScaleY,
            });
          }
        } else {
          // bottom right
          const maxScaleX =
            distanceFromPointToLine(
              oCoords.tl,
              originOCoords.tr,
              originOCoords.br
            ) / target.width;
          const maxScaleY =
            distanceFromPointToLine(
              oCoords.tl,
              originOCoords.bl,
              originOCoords.br
            ) / target.height;

          if (target.scaleX > maxScaleX && target.scaleY > maxScaleY) {
            cropRect.set({
              scaleX: maxScaleX,
              scaleY: maxScaleY,
            });
          } else if (target.scaleX > maxScaleX) {
            cropRect.set({
              scaleX: maxScaleX,
            });
          } else if (target.scaleY > maxScaleY) {
            cropRect.set({
              scaleY: maxScaleY,
            });
          }
        }
      }
    }
  });

  cropRect.on("deselected", function () {
    cancelCrop(cropRect, overlayRect, img, canvas);
  });
};

// The function called when the cancel button is clicked.
const cancelCrop = (cropRect, overlayRect, img, canvas) => {
  delete cropRect.controls.cancelControl;
  delete cropRect.controls.applyControl;
  canvas.remove(overlayRect);
  canvas.remove(cropRect);
  // Select the previous image.
  canvas.setActiveObject(img);
};

export const applyCrop = (cropRect, img, canvas, imageLoader) => {
  const cropLeft = Math.round(
    distanceFromPointToLine(
      cropRect.oCoords.tl,
      img.oCoords.tl,
      img.oCoords.bl
    ) - img.padding
  );
  const cropTop = Math.round(
    distanceFromPointToLine(
      cropRect.oCoords.tl,
      img.oCoords.tl,
      img.oCoords.tr
    ) - img.padding
  );
  const cropWidth = Math.round(cropRect.width * cropRect.scaleX);
  const cropHeight = Math.round(cropRect.height * cropRect.scaleY);

  const multiplier = Math.max(1 / Math.min(img.scaleX, img.scaleY), 1);

  const options = {
    drawingType: img.drawingType,
    angle: img.angle,
    id: img.id,
    name: img.name,
    top: cropRect.top,
    left: cropRect.left,
    scaleX: 1 / multiplier,
    scaleY: 1 / multiplier,
  };

  img.set("angle", 0);
  const dataURL = img.toDataURL({
    multiplier: multiplier,
    top: Math.abs(cropTop),
    left: Math.abs(cropLeft),
    width: cropWidth,
    height: cropHeight,
  });

  // Delete the old image object, i.e., the cropped image object.
  img.set("id", 0);

  canvas.discardActiveObject();

  canvas.remove(img);

  imageLoader(dataURL, options).then((imgObject) => {
    canvas.add(imgObject);
    canvas.renderAll();
  });
};

const createButton = (cropRect, controlType, mouseUpHandler, options) => {
  const iconImg = document.createElement("img");
  iconImg.src = options.icon;
  iconImg.onload = () => {
    cropRect.canvas.requestRenderAll();
  };

  function renderIcon(icon, iconSize) {
    return function renderIcon(ctx, left, top, styleOverride, fabricObject) {
      const size = iconSize;
      ctx.save();
      ctx.translate(left, top);
      ctx.rotate(fabric.util.degreesToRadians(fabricObject.angle));
      ctx.drawImage(icon, -size / 2, -size / 2, size, size);
      ctx.restore();
    };
  }

  // Add controls for the crop box.
  cropRect.controls[controlType] = new fabric.Control({
    x: options.x,
    y: options.y,
    offsetY: options.offsetY,
    offsetX: options.offsetX,
    cursorStyle: options.cursorStyle,
    mouseUpHandler,
    render: renderIcon(iconImg, options.iconSize),
    cornerSize: options.cornerSize,
  });
};

const findIntersection = (pointA, pointB, pointC, pointD) => {
  const x1 = pointA.x;
  const y1 = pointA.y;
  const x2 = pointB.x;
  const y2 = pointB.y;
  const x3 = pointC.x;
  const y3 = pointC.y;
  const x4 = pointD.x;
  const y4 = pointD.y;

  // Check for any vertical lines perpendicular to the y-axis.
  if (x1 === x2) {
    if (x3 === x4) {
      return null; // Both lines are perpendicular and parallel, with no intersection.
    }
    const m2 = (y4 - y3) / (x4 - x3);
    const b2 = y3 - m2 * x3;
    const x = x1;
    const y = m2 * x + b2;
    return { x, y };
  }

  if (x3 === x4) {
    const m1 = (y2 - y1) / (x2 - x1);
    const b1 = y1 - m1 * x1;
    const x = x3;
    const y = m1 * x + b1;
    return { x, y };
  }

  // Check for any horizontal lines.
  if (y1 === y2) {
    if (y3 === y4) {
      return null; // Both lines are horizontal and parallel, with no intersection.
    }
    const m2 = (y4 - y3) / (x4 - x3);
    const b2 = y3 - m2 * x3;
    const y = y1;
    const x = (y - b2) / m2;
    return { x, y };
  }

  if (y3 === y4) {
    const m1 = (y2 - y1) / (x2 - x1);
    const b1 = y1 - m1 * x1;
    const y = y3;
    const x = (y - b1) / m1;
    return { x, y };
  }

  // Calculate the slope and intercept.
  const m1 = (y2 - y1) / (x2 - x1);
  const b1 = y1 - m1 * x1;

  const m2 = (y4 - y3) / (x4 - x3);
  const b2 = y3 - m2 * x3;

  // Check for parallelism.
  if (m1 === m2) {
    return null; // Parallel lines have no intersection.
  }

  // Calculate the intersection point.
  const x = (b2 - b1) / (m1 - m2);
  const y = m1 * x + b1;

  return { x, y };
};

// Calculate the distance between two points.
const calculateDistance = (pointA, pointB) => {
  const x1 = pointA.x;
  const y1 = pointA.y;

  const x2 = pointB.x;
  const y2 = pointB.y;

  let distance = Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
  return distance;
};

// Calculate the distance from point P to the line passing through points A and B.
const distanceFromPointToLine = (pointP, pointA, pointB) => {
  const x1 = pointA.x,
    y1 = pointA.y;
  const x2 = pointB.x,
    y2 = pointB.y;
  const x0 = pointP.x,
    y0 = pointP.y;

  // Calculate the coefficients A, B, and C of the line.
  const A = y2 - y1;
  const B = x1 - x2;
  const C = x2 * y1 - x1 * y2;

  // Calculate the distance from a point to a line.
  const distance = Math.abs(A * x0 + B * y0 + C) / Math.sqrt(A * A + B * B);

  return distance;
};

const getPointOnline = (pointA, pointB, distanceToB) => {
  const n = distanceToB;
  const xA = pointA.x;
  const yA = pointA.y;
  const xB = pointB.x;
  const yB = pointB.y;

  // Calculate the distance between point A and point B.
  const d = Math.sqrt((xB - xA) ** 2 + (yB - yA) ** 2);

  // Calculate the proportionality coefficient t.
  const t = n / d;

  // Calculate the coordinates of point P.
  const xP = xB + t * (xA - xB);
  const yP = yB + t * (yA - yB);

  return { x: xP, y: yP };
};

// Vector subtraction.
const subtract = (v1, v2) => {
  return { x: v1.x - v2.x, y: v1.y - v2.y };
};

// Calculate the projection of point P onto line AB.
const projectPointOntoSegment = (A, B, P) => {
  const AB = subtract(B, A);
  const AP = subtract(P, A);
  const ab2 = AB.x * AB.x + AB.y * AB.y;
  const ap_ab = AP.x * AB.x + AP.y * AB.y;
  const t = Math.max(0, Math.min(1, ap_ab / ab2));
  return { x: A.x + t * AB.x, y: A.y + t * AB.y };
};

const isPointOnSameSideOfLines = (A, B, C, D, P) => {
  // Calculate the vectors AB and CD.
  const AB = { x: B.x - A.x, y: B.y - A.y };
  const CD = { x: D.x - C.x, y: D.y - C.y };

  // Calculate the vectors PA and PC.
  const PA = { x: P.x - A.x, y: P.y - A.y };
  const PC = { x: P.x - C.x, y: P.y - C.y };

  // Calculate the cross product of vectors.
  const crossProduct1 = AB.x * PA.y - AB.y * PA.x;
  const crossProduct2 = CD.x * PC.y - CD.y * PC.x;

  // Determine the sign of the cross product.
  //   return crossProduct1 * crossProduct2 >= 0;

  if (crossProduct1 > 0 && crossProduct2 > 0) {
    return 1; // Point P is to the left of lines AB and CD.
  } else if (crossProduct1 < 0 && crossProduct2 < 0) {
    return 2; // Point P is to the right of lines AB and CD.
  } else {
    return 0; // Point P is between or on the extensions of lines AB and CD.
  }
};

const loadFromURL = (url, options) =>
  new Promise((resolve) => {
    const imgElement = document.createElement("img");
    imgElement.onload = () => {
      resolve(new fabric.Image(imgElement, options));
    };
    imgElement.src = url;
  });

const defalutApplyIcon =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAEvklEQVRYha2XW2xVVRCGv3+dAkoLsVykgQRIIEFCiVDL5YUgBqJGGl6UtFii3CsGgrwQQ+ITURNjolETilzlFvCBoAHaEBPUREoLGoT2CYTIA+USr6AY7Rqz9t7n0HNpaWnn9Jx0rdlr/f/MmjUzW9RTUBRNKlFZ+BkAehbZLGCGoQkyjQQLD91GXME4K9QM1mjY3aAyGYr2sXiXHOkJgceBjQa1wsZYMltos3hFpL0t6RBe73v5K90RcF3sEytNmyRdRmwiAacbcBIYgxGYXke65HBvd7emIAGZSkEnvOxdb77ErDvIwuKjT4cz7E2hJqHxPSSgMkkXDHuusNN6J2EPj5/l5C5KKn8QgcGCcx4/ps/IOdJhHcUyNQuy9nbZA3ccbHR/g6fF8I8K91VBAg5tlDG3707PQgzBkDU0+UlCH6bnomsoo1jSnXBnHyLe8iWdPu4kBB4BBt0nIymwGWfYzy6ZeMvTT+BpaYd109fzxaKj0AH8k5vXeC/Cpp6UpN/NrLjPoOkM1Q4vPvkSny86HE1/fe0b5h1+Giu2zKEnyWm4E1qg/gDnPviSiiUZ8CCnrp2KgdX54TDQoiLBXMvNrenxb3EFYCixG3tg+eLpi9m/cH9GVXfyNeqbtsYJvTMBWYiJZ5yHmXlnH8a/wtoZa5k3fh7cekDSDs/fgMXTFnOo6lA2+HdbYWSB9QFUNq0IbELeZndhy9wtbJ69OYrc8t3ltF5vhVHZ1yoj16G2spa9L+zNTC1vWMGuMzuhLAHPMTIuahoeVMPyNuyAiaUT4/8dnH75NOWjy+FmAUtuQHVFdRb4soZl7GruGvw+CSvJC41oVALVR6qp/zGu1UMGDaGptonJoybHJFLJs+1QM72Gg1UHM8tXN65hd/Pu2FvdgKfFxaedIwNiEnVH66g/vy3SFQ8opqW2hUmjnoisDkRqKmo4sPBAZu2qxlV82rStx+DhsJ0zdzVv2ieZqxTqvlzDRz98HJMYVMzZpS2MHTqO+ZPmZ4G/cuJVtp/Z/kC358gvRYhmJ83xuVfBkhT6GKw/to7QE6yvWEfJwBLaVrdGHknLysaVfNaypzeWx4nIuJiyKgYjqgs+ZclxFEHDhROUDS2jsqySgamBmchZ0bCSnWd29NbyUHlDDfgkpSqFI9jUKbTySRTFRI6dP0ZpcSmzR8+OVEuPL2VPsLyX4IkLwi1YVWTYPaEdQnVddkCWxMQw2HByQ3QrLv1xmX3n9sXg3XWphbAVtX0NZlwX9ZEvRzi4ZV32rokEK/9LyqyLb0pvwV1cA0JMTTFoc0mbcBt454GrfQI8JFyJZK63JVzR3wGTtYV6kPVe4HAXDF/er11RHr7aDcaC/RtjdhLDFjhSfyknOfYPcLoHYH4avBCBdm9+psP97eg/GlHQKZy25hnW2lmXV2RN1urNpjpS30e9W1/Bw9enfjJvlYY/lavvosrbZW/2FOY+CH54GCJhjVMKZ6ldeJsCnCvk0m7aDMO8f8N5V+682yd0775JnczLIKYjPHycpbyO0MEsb7YcWby2ENFCb8eyeJuQE5yFszO8rEy45yXNMfxUw0aZLDRrEvpTppuCNjO+NWh0pquh006uXfSaHr5ZAvwPfLzCeo8d28wAAAAASUVORK5CYII=";
const defalutCancelIcon =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAEWElEQVRYhbWXzU9cVRjGf+fOnRFTbAdoYUCkHzDAkPrRj6QVoaUaUdPERGN01RhXJq5c6NalC/0DjBsXxrjQGDdNWtPEFmmZQtPEaGwLLTBgKTMDkQIpX3PvPeY9zJiRzh1uFZ7kJHe4z3ueh3ve9z3nqKnGAwREDXAaOAkcBCTwsXzoKpACbgH9wFngXpBpgxgQsQ+AM0BlQLM54FvgC2Dw/xj4DPg4oKgfvgQ+BFZKvbd8glqA37ZAXPA+cBM4GtSAfPJfgae3QLyAfcA14NRmBpqAIWDHFooX42fgUDkDl4DHt0m8gIuAXcrA58D+bRYX7AK+2WhA1ugj3xDbxltYwJuZNc9leTOzhluWB+8AR4oNfOLHVDJpNoMVjWIn2nBTY+ZvpXhuahS7o91wvZlMSV4RPjVxU40HJOEWZY5SLL24gKqOUvvTOUL1MdKHj7F2+waRfa1ox1kXD9msTYwQSTyjY0MDuNPTKtv7KnpuHvXEznImmuQLvOUnLvCWlwntqcWOt6AqK6lL9hNubmMtNYKyw2aIeDie0HUDfajKHUq4Vs0evOWlcuKCM2Lg5XKMUKyB1aGrpDu7tXZdbdVUU5e8TLiljVxq2IxI+0EdGxxQVjSqtOOSOd7F2vVrhOqf3MxAjyzBdeCwL0UpUBZrk7epONapY/19irCNN3efqab9KEvphskU1q6dSq/lyHSdZPVaknBTHLQHWpczcEcMzANlF6pgIicmnu+i7peLJsud0XF5q+3m/UrncmS7e1geHCASTFywKAaWAjUfpVD5LxFpSbDn/Fns5vWNzBkdJdt7mtzYMJG9cbQXSFywJDkQiGkmtCyTre7srMZ1/4mTdZf6N5msrKDiJlQMeEGYptRSw9htHbphbBi7Na68v+ZMLoTbWmkYH8GOJwxHuI9iYCyQuNR5a4eOJa9gVVWZNU8/e4TpQ0e1dj1THbGB9eoQbkATM1b+GOUvbtvkJkaJtHVQN5RUVlVUkXNMtufujuNMjCpJPp1ztLW7mtjQVcLxdhOzSScUpKz8FukLN32PyOEj1N/6Q0oNKbV01wlWh5KE97aasZLsV5nuHo3jaKsqSsPITSLPHcJJb3osvCwGvitLscPoBw/w5ufNz+yJU+viUmqea4Y8rw5esTLdLxqOd38evbSECoc3M/B14Uz4fb4lPwRptc69u9jNLYTqalm5dMEI6uI6z/cJR/rEqV7tpjPKGbuDXd+IdnJ+4gPACwUDCeCGH1NMuNksemWFUNNT4LoPl5qYCIVwJ/9EVVQQqq0tJy7oAfqKT8VfAe9t9s22CBeAXuO7yID0kZn8BWQ7IXv4bsAkVfGRTJc6tW4DXimIbzQg+D2/NtuFtzeWfal7QR9wHJjaQhPyH7+Wr7Z/we9mJPe5DqnTLRD/MV9l50u99DMgWADeBV4CfvgPwueA14E3gWk/0qNcz1uBN4DO/HMtUGh1LpDJb2xysxLDkk/lAfwNoz+a3zHVYDwAAAAASUVORK5CYII=";
