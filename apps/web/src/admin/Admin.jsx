'use client';

import { useEffect } from 'react';
import { useQueue } from '../shared/hooks/useQueue';
import { GroupButtons } from './components/GroupButtons';

// Normaliza al formato nuevo (accounts[]) soportando también el antiguo.
const getAccounts = (element) =>
  element.accounts
  ?? (element.chessUser ? [{ provider: element.provider, chessUser: element.chessUser, ratings: element.ratings }] : []);

const formatAccount = (account) => {
  const ratings = account?.ratings ?? {};
  return {
    provider: account?.provider,
    chessUser: account?.chessUser,
    rating: {
      bullet: ratings.bullet?.rating ?? 'N/A',
      blitz: ratings.blitz?.rating ?? 'N/A',
      rapid: ratings.rapid?.rating ?? 'N/A',
    },
  };
};

export default function Admin() {
  const { data } = useQueue();

  useEffect(() => {
    console.log(data);
  }, [data]);

  return (
    <main className='flex h-screen v-screen'>
      <div className='w-3/5 flex flex-col justify-center items-center'>
        <div
          className='flex justify-center items-center h-full w-full bg-white/5'
        >
          <GroupButtons
            title='Cola'
            buttons={[
              {
                onClick: () => {
                  fetch('/api/admin/queue/pop', {
                    method: 'GET',
                  });
                },
                text: 'Siguiente',
              },
              // <button
              //   className='bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded'
              //   onClick={() => {
              //     fetch('/api/admin/queue', {
              //       method: 'DELETE',
              //     });
              //   }}
              // >Limpiar</button>,
              {
                onClick: () => {
                  fetch('/api/admin/queue', {
                    method: 'DELETE',
                  });
                },
                text: 'Limpiar',
                confirm: true,
              }
            ]}
          />
        </div>
      </div>
      <div className='w-2/5 flex flex-col justify-center items-center'>
        <div
          className='flex h-full w-full'
        >
          <ul>
            {
              data.map((item) => {
                if (item.state === 'hide') {
                  return null;
                }
                const accounts = getAccounts(item).map(formatAccount);
                return <li key={item.uuid} className='mb-2'>
                  <p className='font-bold'>{item.username}</p>
                  {accounts.map((account, i) => (
                    <div className='flex gap-4 pl-4' key={account.provider ?? i}>
                      <p className='text-sm opacity-70'>{account.provider}</p>
                      <p>{account.chessUser}</p>
                      <div className='flex gap-1'>
                        <p>{account.rating.bullet}</p>
                        <span>|</span>
                        <p>{account.rating.blitz}</p>
                        <span>|</span>
                        <p>{account.rating.rapid}</p>
                      </div>
                    </div>
                  ))}
                </li>;
              })
            }
          </ul>
        </div>
      </div>
    </main>
  );
}
