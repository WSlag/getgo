import { useState, useEffect, useMemo } from 'react';
import { collection, query, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { formatTimeAgo } from '../utils/dateFormatting';

const isRead = (notification) => notification?.isRead === true || notification?.read === true;

export function useNotifications(userId, maxResults = 50) {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!userId) {
      setNotifications([]);
      setLoading(false);
      return;
    }

    const q = query(
      collection(db, 'users', userId, 'notifications'),
      orderBy('createdAt', 'desc'),
      limit(maxResults)
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const data = snapshot.docs.map((doc) => {
          const docData = doc.data();
          const createdAt = docData.createdAt?.toDate?.() || new Date();
          return {
            id: doc.id,
            ...docData,
            createdAt,
            time: formatTimeAgo(createdAt),
            read: isRead(docData),
            isRead: isRead(docData),
          };
        });
        setNotifications(data);
        setLoading(false);
        setError(null);
      },
      (err) => {
        console.error('Error fetching notifications:', err);
        setError(err.message);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [userId, maxResults]);

  const unreadCount = useMemo(() => {
    return notifications.filter((n) => !isRead(n)).length;
  }, [notifications]);

  return { notifications, unreadCount, loading, error };
}


export default useNotifications;
