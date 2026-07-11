import React from "react";
import LoadingSpinner from "@/components/loader/LoadingSpinner";

const Loading: React.FC = () => {
  return (
    <div className="loading-container">
      <LoadingSpinner variant="glass" size="lg" text="" delay={150} />
    </div>
  );
};

export default Loading;
