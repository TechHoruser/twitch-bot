import { useEffect, useState } from "react";

export const useQueue = () => {
  const [data, setData] = useState([]);

  useEffect(() => {
    const evtSource = new EventSource('/api/overload');
    evtSource.addEventListener('newQueueElement', (event) => {
      console.log('newQueueElement', event.data);
      const payload = JSON.parse(event.data);
      setData(prev => [...prev, { ...payload, state: 'alive'}]);
    });
    evtSource.addEventListener('dropQueueElement', (event) => {
      console.log('dropQueueElement', event.data);
      const uuid = event.data;
      setData(prev => prev.map(item => {
        if (item.uuid === uuid) {
          return { ...item, state: 'hide' };
        }
        return item;
      }));
    });
    return () => {
      evtSource.close();
    };
  }, []);

  return {
    data,
    setData,
  };
}
