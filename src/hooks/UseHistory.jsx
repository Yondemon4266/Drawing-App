import { useEffect, useState } from "react";

export function UseHistory(initialState) {
  const [index, setIndex] = useState(getIndexFromStorage());
  const [history, setHistory] = useState(getHistoryFromStorage());

  function getHistoryFromStorage() {
    const value = localStorage.getItem("elementsHistory");
    if (!value) return [initialState];
    return JSON.parse(value);
  }
  function saveHistoryToStorage() {
    localStorage.setItem("elementsHistory", JSON.stringify(history));
  }
  function getIndexFromStorage() {
    const value = localStorage.getItem("index");
    if (!value) return 0;
    return JSON.parse(value);
  }
  function saveIndexToStorage() {
    localStorage.setItem("index", JSON.stringify(index));
  }

  useEffect(() => {
    saveIndexToStorage();
    saveHistoryToStorage();
  }, [history, index]);

  function setState(action, overwrite = false) {
    const newState =
      typeof action === "function" ? action(history[index]) : action;
    if (overwrite) {
      const historyCopy = [...history];
      historyCopy[index] = newState;
      setHistory(historyCopy);
    } else {
      const updatedState = [...history].slice(0, index + 1);
      setHistory(() => [...updatedState, newState]);
      setIndex((prevState) => prevState + 1);
    }
  }
  const undo = () => index > 0 && setIndex((prevState) => prevState - 1);
  const redo = () =>
    index < history.length - 1 && setIndex((prevState) => prevState + 1);

  const eraseAll = () => setIndex(0);
  return [history[index], setState, undo, redo, eraseAll];
}
