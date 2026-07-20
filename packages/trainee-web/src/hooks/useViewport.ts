import { useEffect, useState } from 'react';

export function useViewport() {
  const [isNarrow, setIsNarrow] = useState(() => window.innerWidth < 1024);

  useEffect(() => {
    const handleResize = () => {
      setIsNarrow(window.innerWidth < 1024);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return { isNarrow };
}
