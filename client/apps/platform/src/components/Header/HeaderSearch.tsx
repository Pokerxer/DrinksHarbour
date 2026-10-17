"use client";

import React from "react";
import * as Icon from "react-icons/pi";
import { useModalSearchUIContext } from "@/context/ModalSearchContext";

interface HeaderSearchProps {
  variant: "default" | "transparent" | "dark";
}

export const HeaderSearch: React.FC<HeaderSearchProps> = ({ variant }) => {
  const { openModalSearch } = useModalSearchUIContext();
  const isDark = variant === "dark";

  return (
    <div className="flex min-w-0 flex-1 lg:mx-1 xl:mx-2">
      <button
        onClick={openModalSearch}
        className={`w-full flex items-center gap-2.5 px-3 md:px-4 py-2.5 rounded-full border transition-all duration-200 ${
          isDark
            ? "bg-white/10 border-white/20 hover:bg-white/15 hover:border-white/35"
            : "bg-gray-50 border-gray-200 hover:border-red-300 hover:shadow-sm hover:bg-white"
        }`}
      >
        <Icon.PiMagnifyingGlass
          size={16}
          className={isDark ? "text-white/50" : "text-gray-400"}
        />
        <span className={`min-w-0 flex-1 truncate text-sm text-left ${isDark ? "text-white/50" : "text-gray-400"}`}>
          Search DrinksHarbour
        </span>
      </button>
    </div>
  );
};
