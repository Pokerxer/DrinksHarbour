"use client";

import React from "react";
import * as Icon from "react-icons/pi";
import { useModalSearchContext } from "@/context/ModalSearchContext";

interface HeaderSearchProps {
  variant: "default" | "transparent" | "dark";
  mobile?: boolean;
}

export const HeaderSearch: React.FC<HeaderSearchProps> = ({ variant, mobile = false }) => {
  const { openModalSearch } = useModalSearchContext();
  const isDark = variant === "dark";

  if (mobile) {
    return (
      <button
        onClick={openModalSearch}
        className="w-full flex items-center gap-3 px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl hover:border-red-300 transition-colors"
      >
        <Icon.PiMagnifyingGlass size={18} className="text-gray-400 flex-shrink-0" />
        <span className="text-sm text-gray-400">Search products...</span>
      </button>
    );
  }

  return (
    <div className="hidden md:flex flex-1 max-w-sm mx-4">
      <button
        onClick={openModalSearch}
        className={`w-full flex items-center gap-2.5 px-4 py-2.5 rounded-full border transition-all duration-200 ${
          isDark
            ? "bg-white/10 border-white/20 hover:bg-white/15 hover:border-white/35"
            : "bg-gray-50 border-gray-200 hover:border-red-300 hover:shadow-sm hover:bg-white"
        }`}
      >
        <Icon.PiMagnifyingGlass
          size={16}
          className={isDark ? "text-white/50" : "text-gray-400"}
        />
        <span className={`flex-1 text-sm text-left ${isDark ? "text-white/50" : "text-gray-400"}`}>
          Search products...
        </span>
      </button>
    </div>
  );
};
