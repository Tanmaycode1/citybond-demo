"use client";
import { createContext, useContext } from "react";

export const JourneyRoleContext = createContext("");
export const useJourneyRole = () => useContext(JourneyRoleContext);
