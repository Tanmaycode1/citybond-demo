"use client";
import { createContext, useContext } from "react";

export const JourneyRoleContext = createContext("");
export const useJourneyRole = () => useContext(JourneyRoleContext);
export const DraftPreviewContext = createContext(false);
export const useDraftPreview = () => useContext(DraftPreviewContext);
