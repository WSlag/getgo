import { useState, useEffect, useMemo } from 'react';
import { collection, query, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { formatTimeAgo } from '../utils/dateFormatting';
import { parseTimestampSafely, sortEntitiesNewestFirst } from '../utils/activitySorting';
import { isPermissionDeniedError, reportFirestoreListenerError } from '../utils/firebaseErrors';

const isRead = (notification) => notification?.isRead === true || notification?.read === true;

export function useNotifications(userId, maxResults = 50, enabled = true) {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      setError(null);
      return;
    }

    if (!userId) {
      setNotifications([]);
      setLoading(false);
      setError(null);
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
          const createdAt = parseTimestampSafely(docData.createdAt);
          return {
            id: doc.id,
            ...docData,
            createdAt: createdAt.date,
            time: createdAt.hasTimestamp ? formatTimeAgo(createdAt.date) : '',
            read: isRead(docData),
            isRead: isRead(docData),
          };
        });
        setNotifications(sortEntitiesNewestFirst(data));
        setLoading(false);
        setError(null);
      },
      (err) => {
        reportFirestoreListenerError('notifications', err);
        setNotifications([]);
        setError(isPermissionDeniedError(err) ? null : err.message);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [userId, maxResults, enabled]);

  const unreadCount = useMemo(() => {
    return notifications.filter((n) => !isRead(n)).length;
  }, [notifications]);

  return { notifications, unreadCount, loading, error };
}


export default useNotifications;
