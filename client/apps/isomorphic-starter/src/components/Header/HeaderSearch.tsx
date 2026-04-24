"use client";

import React from "react";
import * as Icon from "react-icons/pi";
import { useModalSearchContext } from "@/context/ModalSearchContext";

interface HeaderSearchProps {
  variant: "default" | "transparent" | "dark";
}

export const HeaderSearch: React.FC<HeaderSearchProps> = ({ variant }) => {
  const { openModalSearch } = useModalSearchContext();

  return (
    <div className="hidden md:flex flex-1 max-w-md mx-4">
      <div
        className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl border transition-all duration-200 hover:border-green-500 hover:shadow-md ${
          variant === "dark"
            ? "bg-white/10 border-white/20"
            : "bg-gray-50 border-gray-200"
        }`}
      >
        <Icon.PiMagnifyingGlass
          size={18}
          className={variant === "dark" ? "text-white/50" : "text-gray-400"}
        />
        <input
          type="text"
          placeholder="Search products..."
          onClick={openModalSearch}
          readOnly
          className={`flex-1 bg-transparent text-sm focus:outline-none cursor-pointer ${
            variant === "dark"
              ? "text-white/70 placeholder-white/50"
              : "text-gray-500 placeholder-gray-400"
          }`}
        />
      </div>
    </div>
  );
};