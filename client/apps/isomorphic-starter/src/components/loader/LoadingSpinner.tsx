import React from "react";
import { motion } from "framer-motion";

interface LoadingSpinnerProps {
  size?: "sm" | "md" | "lg";
  text?: string;
  className?: string;
  fullScreen?: boolean;
}

const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  size = "md",
  text = "Loading...",
  className = "",
  fullScreen = false,
}) => {
  const sizeClasses = {
    sm: "w-6 h-6 border-2",
    md: "w-10 h-10 border-[3px]",
    lg: "w-14 h-14 border-4",
  };

  if (fullScreen) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className={`fixed inset-0 bg-white/90 backdrop-blur-sm z-50 flex flex-col items-center justify-center ${className}`}
      >
        <motion.div
          animate={{
            rotate: 360,
            scale: [1, 1.1, 1],
          }}
          transition={{
            rotate: { duration: 1, repeat: Infinity, ease: "linear" },
            scale: { duration: 0.5, repeat: Infinity, ease: "easeInOut" },
          }}
          className={`${sizeClasses[size]} border-gray-200 border-t-emerald-500 rounded-full`}
        />
        <motion.p
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="mt-4 text-gray-600 font-medium"
        >
          {text}
        </motion.p>
        <div className="flex gap-1.5 mt-4">
          {[0, 1, 2, 3].map((i) => (
            <motion.div
              key={i}
              animate={{ opacity: [0.3, 1, 0.3] }}
              transition={{
                duration: 1,
                repeat: Infinity,
                delay: i * 0.15,
              }}
              className="w-2 h-2 bg-emerald-500 rounded-full"
            />
          ))}
        </div>
      </motion.div>
    );
  }

  return (
    <div className={`flex flex-col items-center justify-center ${className}`}>
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
        className={`${sizeClasses[size]} border-gray-200 border-t-emerald-500 rounded-full`}
      />
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
