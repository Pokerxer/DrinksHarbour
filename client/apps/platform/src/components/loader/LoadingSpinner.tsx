'use client';

import React from "react";
import { motion } from "framer-motion";

interface LoadingSpinnerProps {
  size?: "sm" | "md" | "lg" | "xl";
  variant?: "spinner" | "dots" | "pulse" | "bounce" | "ring";
  text?: string;
  className?: string;
  fullScreen?: boolean;
  color?: "emerald" | "amber" | "rose" | "blue" | "purple";
}

const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  size = "md",
  variant = "spinner",
  text = "Loading...",
  className = "",
  fullScreen = false,
  color = "emerald",
}) => {
  const colorClasses = {
    emerald: "border-t-emerald-500 bg-emerald-500",
    amber: "border-t-amber-500 bg-amber-500",
    rose: "border-t-rose-500 bg-rose-500",
    blue: "border-t-blue-500 bg-blue-500",
    purple: "border-t-purple-500 bg-purple-500",
  };

  const sizeClasses = {
    sm: "w-5 h-5 border-2",
    md: "w-8 h-8 border-[3px]",
    lg: "w-12 h-12 border-4",
    xl: "w-16 h-16 border-[5px]",
  };

  const ringSizes = {
    sm: "w-6 h-6",
    md: "w-10 h-10",
    lg: "w-16 h-16",
    xl: "w-24 h-24",
  };

  const renderSpinner = () => (
    <motion.div
      animate={{ rotate: 360 }}
      transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
      className={`${sizeClasses[size]} border-gray-200 ${colorClasses[color]} rounded-full`}
    />
  );

  const renderDots = () => (
    <div className="flex items-center gap-1.5">
      {[0, 1, 2].map((i) => (
        <motion.div
          key={i}
          animate={{
            scale: [0.8, 1.2, 0.8],
            opacity: [0.5, 1, 0.5],
          }}
          transition={{
            duration: 0.8,
            repeat: Infinity,
            delay: i * 0.12,
            ease: "easeInOut",
          }}
          className={`${size === "sm" ? "w-1.5 h-1.5" : size === "lg" ? "w-3 h-3" : "w-2 h-2"} ${colorClasses[color].split(" ")[1]} rounded-full`}
        />
      ))}
    </div>
  );

  const renderPulse = () => (
    <motion.div
      animate={{
        scale: [1, 1.4, 1],
        opacity: [1, 0.5, 1],
      }}
      transition={{
        duration: 1.2,
        repeat: Infinity,
        ease: "easeInOut",
      }}
      className={`${sizeClasses[size]} rounded-full bg-gradient-to-br from-${color}-400 to-${color}-600`}
    />
  );

  const renderBounce = () => (
    <div className="flex items-end gap-1">
      {[0, 1, 2].map((i) => (
        <motion.div
          key={i}
          animate={{
            height: ["30%", "100%", "30%"],
            opacity: [0.5, 1, 0.5],
          }}
          transition={{
            duration: 0.8,
            repeat: Infinity,
            delay: i * 0.1,
            ease: "easeInOut",
          }}
          className={`${size === "sm" ? "w-1" : size === "lg" ? "w-3" : "w-2"} ${colorClasses[color].split(" ")[1]} rounded-full`}
        />
      ))}
    </div>
  );

  const renderRing = () => (
    <div className="relative">
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
        className={`${ringSizes[size]} rounded-full border-4 border-gray-200 border-t-${color}-500`}
      />
      <motion.div
        animate={{ rotate: -360 }}
        transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
        className={`absolute inset-1 ${ringSizes[size].replace("w-", "w-[calc(").replace(" h-", "-h-")}] rounded-full border-2 border-transparent border-b-${color}-300`}
        style={{ transform: "scale(0.85)" }}
      />
    </div>
  );

  const renderLoader = () => {
    switch (variant) {
      case "dots": return renderDots();
      case "pulse": return renderPulse();
      case "bounce": return renderBounce();
      case "ring": return renderRing();
      default: return renderSpinner();
    }
  };

  if (fullScreen) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className={`fixed inset-0 bg-white/95 backdrop-blur-md z-50 flex flex-col items-center justify-center ${className}`}
      >
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.3 }}
        >
          {renderLoader()}
        </motion.div>
        
        {text && (
          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="mt-6 text-gray-600 font-medium"
          >
            {text}
          </motion.p>
        )}
        
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: 120 }}
          transition={{ delay: 0.3, duration: 0.8, ease: "easeInOut" }}
          className="h-0.5 bg-gradient-to-r from-emerald-400 to-teal-500 rounded-full mt-4"
        />
      </motion.div>
    );
  }

  return (
    <div className={`flex flex-col items-center justify-center ${className}`}>
      {renderLoader()}
      {text && (
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="mt-3 text-gray-500 text-sm font-medium"
        >
          {text}
        </motion.p>
      )}
    </div>
  );
};

export default LoadingSpinner;