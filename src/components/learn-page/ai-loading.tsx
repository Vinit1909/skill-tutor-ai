import React from 'react';
import { Orbit } from 'lucide-react';

const LoadingBubble = () => {
  return (
    <div className="flex items-center w-full rounded-xl gap-4">
      <Orbit className="flex-shrink-0 mr-2 mt-2 h-8 w-8 rounded-full p-1 overflow-visible border border-neutral-300 dark:border-neutral-600 text-[#6c63ff] dark:text-[#7a83ff]" />
      
      <div className="flex items-center space-x-3 p-3 bg-neutral-100 dark:bg-[hsl(0,0%,20%)] rounded-2xl">
        <div className="w-1.5 h-1.5 bg-[#6c63ff] dark:bg-[#7a83ff] rounded-full animate-[pulse_1.5s_ease-in-out_infinite] [animation-delay:-0.3s]"></div>
        <div className="w-1.5 h-1.5 bg-[#6c63ff] dark:bg-[#7a83ff] rounded-full animate-[pulse_1.5s_ease-in-out_infinite] [animation-delay:-0.15s]"></div>
        <div className="w-1.5 h-1.5 bg-[#6c63ff] dark:bg-[#7a83ff] rounded-full animate-[pulse_1.5s_ease-in-out_infinite]"></div>
      </div>
    </div>
  );
};

export default LoadingBubble;