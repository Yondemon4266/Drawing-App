import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import rough from "roughjs";
import { GiArrowCursor, GiBroom } from "react-icons/gi";
import { IoRemoveOutline } from "react-icons/io5";
import { PiPencilLineThin, PiRectangle } from "react-icons/pi";
import { ImUndo, ImRedo } from "react-icons/im";
import { CiText } from "react-icons/ci";

import {
  adjustElementCoordinates,
  adjustmentRequired,
  createElement,
  cursorForPosition,
  drawElement,
  getElementAtPosition,
  resizedCoordinates,
} from "./Utils";
import { UseHistory } from "./hooks/UseHistory";
import usePressedKeys from "./hooks/UsePressedKeys";

export const generator = rough.generator();

export default function App() {
  const [elements, setElements, undo, redo, eraseAll] = UseHistory([]);
  const [selectedElement, setSelectedElement] = useState(null);
  const [action, setAction] = useState("none");
  const [tool, setTool] = useState("pencil");
  const [textSize, setTextSize] = useState({
    size: "24",
  });
  const [pencilSize, setPencilSize] = useState(8);
  const pressedKeys = usePressedKeys();
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [startPanMousePosition, setStartPanMousePosition] = useState({
    x: 0,
    y: 0,
  });
  const [scale, setScale] = useState(1);
  const [scaleOffset, setScaleOffset] = useState({ x: 0, y: 0 });
  const textAreaRef = useRef(null);
  useLayoutEffect(() => {
    const canvas = document.getElementById("canvas");
    const ctx = canvas.getContext("2d");
    const roughCanvas = rough.canvas(canvas);

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const scaledWidth = canvas.width * scale;
    const scaledHeight = canvas.height * scale;

    const scaleOffsetX = (scaledWidth - canvas.width) / 2;
    const scaleOffsetY = (scaledHeight - canvas.height) / 2;
    setScaleOffset({ x: scaleOffsetX, y: scaleOffsetY });

    ctx.save();
    ctx.translate(
      panOffset.x * scale - scaleOffsetX,
      panOffset.y * scale - scaleOffsetY
    );

    ctx.scale(scale, scale);

    elements.forEach((element) => {
      if (action === "writing" && selectedElement.id === element.id) return;
      drawElement(roughCanvas, ctx, element);
    });
    ctx.restore();
  }, [elements, action, selectedElement, textSize, panOffset, scale]);

  useEffect(() => {
    const shortcuts = (event) => {
      if (action !== "writing") {
        if ((event.metaKey || event.ctrlKey) && event.key === "z") {
          undo();
        } else if ((event.metaKey || event.ctrlKey) && event.key === "y") {
          redo();
        } else if (event.key === "p") {
          setTool("pencil");
        } else if (event.key === "s") {
          setTool("selection");
        } else if (event.key === "l") {
          setTool("line");
        } else if (event.key === "r") {
          setTool("rectangle");
        } else if (event.key === "t") {
          setTool("text");
        }
      }
    };
    document.addEventListener("keydown", shortcuts);
    return () => document.removeEventListener("keydown", shortcuts);
  }, [undo, redo, setTool]);

  useEffect(() => {
    const textArea = textAreaRef.current;
    if (action === "writing" && textArea) {
      setTimeout(() => {
        textArea.focus();
        textArea.value = selectedElement.text;
      }, 50);
    }
  }, [action, selectedElement]);

  useEffect(() => {
    const panOrZoomFunction = (e) => {
      if (pressedKeys.has("Alt")) onZoom(e.deltaY * -0.001);
      else {
        setPanOffset((prev) => ({
          x: prev.x - e.deltaX,
          y: prev.y - e.deltaY,
        }));
      }
    };
    document.addEventListener("wheel", panOrZoomFunction);
    return () => document.removeEventListener("wheel", panOrZoomFunction);
  }, [pressedKeys]);

  function updateElement(id, x1, y1, x2, y2, type, options) {
    const elementsCopy = [...elements];

    switch (type) {
      case "line":
      case "rectangle": {
        elementsCopy[id] = createElement(id, x1, y1, x2, y2, type);
        break;
      }
      case "pencil":
        elementsCopy[id].points = [
          ...elementsCopy[id].points,
          { x: x2, y: y2 },
        ];
        elementsCopy[id] = { ...elementsCopy[id], pencilSize: pencilSize };
        break;
      case "text": {
        const textWidth = document
          .getElementById("canvas")
          .getContext("2d")
          .measureText(options.text).width;

        const textHeight = parseInt(textSize.size);

        elementsCopy[id] = {
          ...createElement(id, x1, y1, x1 + textWidth, y1 + textHeight, type),
          text: options.text,
        };
        break;
      }
      default:
        break;
    }
    setElements(elementsCopy, true);
  }
  function getMouseCoordinates(e) {
    const clientX = (e.clientX - panOffset.x * scale + scaleOffset.x) / scale;
    const clientY = (e.clientY - panOffset.y * scale + scaleOffset.y) / scale;
    return { clientX, clientY };
  }

  function onZoom(delta) {
    setScale((prev) => Math.min(Math.max(prev + delta, 0.1), 20));
  }

  function handleBlur(event) {
    const { id, x1, y1, type } = selectedElement;
    setAction("none");
    setSelectedElement(null);
    updateElement(id, x1, y1, null, null, type, { text: event.target.value });
  }
  const handleMouseDown = (e) => {
    if (action === "writing") return;

    const { clientX, clientY } = getMouseCoordinates(e);
    if (e.button === 1) {
      setAction("panning");
      setStartPanMousePosition({ x: clientX, y: clientY });
      return;
    }
    if (tool === "selection") {
      const element = getElementAtPosition(clientX, clientY, elements);
      if (element) {
        if (element.type === "pencil") {
          const xOffsets = element.points.map((point) => clientX - point.x);
          const yOffsets = element.points.map((point) => clientY - point.y);
          setSelectedElement({ ...element, xOffsets, yOffsets });
        } else {
          const offsetX = clientX - element.x1;
          const offsetY = clientY - element.y1;
          setSelectedElement({ ...element, offsetX, offsetY });
        }
        setElements((prevState) => prevState);
        if (element.position === "inside") {
          setAction("moving");
        } else {
          setAction("resizing");
        }
      }
    } else {
      const id = elements.length;
      const element = createElement(
        id,
        clientX,
        clientY,
        clientX,
        clientY,
        tool
      );
      setElements((prev) => [...prev, element]);
      setSelectedElement(element);
      setAction(tool === "text" ? "writing" : "drawing");
    }
  };
  const handleMouseMove = (e) => {
    const { clientX, clientY } = getMouseCoordinates(e);

    if (action === "panning") {
      const deltaX = clientX - startPanMousePosition.x;
      const deltaY = clientY - startPanMousePosition.y;
      setPanOffset((prev) => ({ x: prev.x + deltaX, y: prev.y + deltaY }));
      return;
    }

    if (tool === "selection") {
      const element = getElementAtPosition(clientX, clientY, elements);
      e.target.style.cursor = element
        ? cursorForPosition(element.position)
        : "default";
    }
    if (action === "drawing") {
      const index = elements.length - 1;
      const { x1, y1 } = elements[index];
      updateElement(index, x1, y1, clientX, clientY, tool);
    } else if (action === "moving") {
      if (selectedElement.type === "pencil") {
        const newPoints = selectedElement.points.map((point, index) => ({
          x: clientX - selectedElement.xOffsets[index],
          y: clientY - selectedElement.yOffsets[index],
        }));
        const elementsCopy = [...elements];
        elementsCopy[selectedElement.id] = {
          ...elementsCopy[selectedElement.id],
          points: newPoints,
        };
        setElements(elementsCopy, true);
      } else {
        const { id, x1, x2, y1, y2, type, offsetX, offsetY } = selectedElement;
        const width = x2 - x1;
        const height = y2 - y1;
        const newX1 = clientX - offsetX;
        const newY1 = clientY - offsetY;
        const options = type === "text" ? { text: selectedElement.text } : {};
        updateElement(
          id,
          newX1,
          newY1,
          newX1 + width,
          newY1 + height,
          type,
          options
        );
      }
    } else if (action === "resizing") {
      const { id, type, position, ...coordinates } = selectedElement;
      const { x1, y1, x2, y2 } = resizedCoordinates(
        clientX,
        clientY,
        position,
        coordinates
      );
      updateElement(id, x1, y1, x2, y2, type);
    }
  };
  const handleMouseUp = (e) => {
    const { clientX, clientY } = getMouseCoordinates(e);
    if (selectedElement) {
      if (
        selectedElement.type === "text" &&
        clientX - selectedElement.offsetX === selectedElement.x1 &&
        clientY - selectedElement.offsetY === selectedElement.y1
      ) {
        setAction("writing");
        return;
      }

      const index = selectedElement.id;
      const { id, type } = elements[index];
      if (
        (action === "drawing" || action === "resizing") &&
        adjustmentRequired(type)
      ) {
        const { x1, x2, y1, y2 } = adjustElementCoordinates(elements[index]);
        updateElement(id, x1, y1, x2, y2, type);
      }
    }

    if (action === "writing") return;
    setAction("none");
    setSelectedElement(null);
  };

  return (
    <div>
      <div className="toolbar">
        <div className="tool ">
          <input
            type="radio"
            name="selection"
            id="selection"
            checked={tool === "selection"}
            onChange={() => setTool("selection")}
          />
          <label htmlFor="selection">
            <GiArrowCursor />
          </label>
          <p>S</p>
        </div>
        <div className="tool">
          <input
            type="radio"
            name="line"
            id="line"
            checked={tool === "line"}
            onChange={() => setTool("line")}
          />
          <label htmlFor="line">
            <IoRemoveOutline className="rotate-45" />
          </label>
          <p>L</p>
        </div>

        <div className="tool">
          <input
            type="radio"
            name="rectangle"
            id="rectangle"
            checked={tool === "rectangle"}
            onChange={() => setTool("rectangle")}
          />
          <label htmlFor="rectangle">
            <PiRectangle />
          </label>
          <p>R</p>
        </div>
        <div className="tool">
          <input
            type="radio"
            name="pencil"
            id="pencil"
            checked={tool === "pencil"}
            onChange={() => setTool("pencil")}
          />
          <label htmlFor="pencil">
            <PiPencilLineThin />
          </label>
          <p>P</p>
          {tool === "pencil" && (
            <input
              className="w-16 max-md:absolute max-md:w-10"
              type="range"
              min={1}
              max={60}
              value={pencilSize}
              onChange={(e) => setPencilSize(parseInt(e.target.value))}
            />
          )}
        </div>
        <div className="tool">
          <input
            type="radio"
            name="text"
            id="text"
            checked={tool === "text"}
            onChange={() => setTool("text")}
          />
          <label htmlFor="text">
            <CiText />
          </label>
          <p>T</p>
          {tool === "text" && (
            <input
              className="w-16 max-md:absolute max-md:w-10"
              type="range"
              min={15}
              max={60}
              value={parseInt(textSize.size)}
              onChange={(e) =>
                setTextSize((prev) => ({ ...prev, size: e.target.value }))
              }
            />
          )}
        </div>
        <div className="tool">
          <button type="button" onClick={undo}>
            <ImUndo />
          </button>
          <p>Ctrl Z</p>
        </div>
        <div className="tool">
          <button type="button" onClick={redo}>
            <ImRedo />
          </button>
          <p>Ctrl Y</p>
        </div>

        <div className="tool">
          <button type="button" onClick={eraseAll}>
            <GiBroom />
          </button>
          <p>Clear</p>
        </div>

        <div className="tool">
          <button type="button" onClick={() => setScale(1)}>
            <p
              className=""
              style={{
                color: "black",
                fontSize: "16px",
                fontWeight: "bold",
                width: "fit-content",
                height: "fit-content",
              }}
            >
              {scale.toFixed(1)}
            </p>
          </button>
          <p id="altscroll">Alt Scroll</p>
        </div>
      </div>

      {action === "writing" ? (
        <textarea
          className="textarea"
          ref={textAreaRef}
          onBlur={handleBlur}
          style={{
            left:
              selectedElement.x1 * scale + panOffset.x * scale - scaleOffset.x,
            top:
              selectedElement.y1 * scale + panOffset.y * scale - scaleOffset.y,
            fontSize: `${textSize.size * scale}px`,
          }}
        ></textarea>
      ) : null}

      <canvas
        id="canvas"
        width={window.innerWidth}
        height={window.innerHeight}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onTouchStart={handleMouseDown}
        onTouchMove={handleMouseMove}
        onTouchEnd={handleMouseUp}
      ></canvas>
    </div>
  );
}
