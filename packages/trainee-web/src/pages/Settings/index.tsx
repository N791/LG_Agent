/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-misused-promises, @typescript-eslint/no-unsafe-enum-comparison, @typescript-eslint/prefer-nullish-coalescing, @typescript-eslint/no-floating-promises, @typescript-eslint/no-unused-vars */
import React, { useState, useEffect } from 'react';
import {
  Layout,
  Typography,
  Tabs,
  Form,
  Input,
  Button,
  Switch,
  List,
  message,
  Divider,
} from 'antd';
import { TopNavbar } from '../../components/TopNavbar';
import { useSelector, useDispatch } from 'react-redux';
import { RootState } from '../../store';
import { setCredentials } from '../../store/authSlice';
import api from '../../services/api';
import { notificationService } from '../../services/notification.service';
import { NotificationType } from '@lg-agent/contracts';
import { useTranslation } from 'react-i18next';

const { Content } = Layout;
const { Title, Text } = Typography;

export const Settings: React.FC = () => {
  const { t } = useTranslation('settings');
  const user = useSelector((state: RootState) => state.auth.user);
  const token = useSelector((state: RootState) => state.auth.token);
  const refreshToken = useSelector((state: RootState) => state.auth.refreshToken);
  const tokenExpiresAt = useSelector((state: RootState) => state.auth.tokenExpiresAt);
  const dispatch = useDispatch();

  const [profileForm] = Form.useForm();
  const [passwordForm] = Form.useForm();
  const [loading, setLoading] = useState(false);

  const [notificationPrefs, setNotificationPrefs] = useState<{ type: string; enabled: boolean }[]>(
    [],
  );

  useEffect(() => {
    if (user) {
      profileForm.setFieldsValue({
        username: user.name, // Displaying 'name' in the 'username' field (which is read-only)
        email: user.email,
        nickname: user.nickname,
      });
    }
    loadPreferences();
  }, [user]);

  const loadPreferences = async () => {
    try {
      const prefs = await notificationService.getPreferences();
      setNotificationPrefs(prefs);
    } catch (err) {
      console.error('Failed to load preferences', err);
    }
  };

  const onUpdateProfile = async (values: any) => {
    setLoading(true);
    try {
      const response = await api.patch('/users/me', {
        nickname: values.nickname,
        email: values.email,
      });
      message.success(t('profile.updateSuccess'));

      // Update local Redux state
      if (user && token && refreshToken && tokenExpiresAt) {
        dispatch(
          setCredentials({
            user: response.data,
            token,
            refreshToken,
            tokenExpiresAt,
          }),
        );
      }
    } catch (error) {
      message.error(t('profile.updateError'));
    } finally {
      setLoading(false);
    }
  };

  const onChangePassword = async (values: any) => {
    setLoading(true);
    try {
      await api.post('/users/me/change-password', {
        currentPassword: values.currentPassword,
        newPassword: values.newPassword,
      });
      message.success(t('security.changeSuccess'));
      passwordForm.resetFields();
    } catch (error: any) {
      message.error(error.response?.data?.message || t('security.changeError'));
    } finally {
      setLoading(false);
    }
  };

  const onTogglePreference = async (type: string, checked: boolean) => {
    try {
      await notificationService.updatePreference(type, checked);
      setNotificationPrefs((prev) =>
        prev.map((p) => (p.type === type ? { ...p, enabled: checked } : p)),
      );
      message.success(t('notifications.updateSuccess'));
    } catch (err) {
      message.error(t('notifications.updateError'));
    }
  };

  const getNotificationLabel = (type: string) => {
    switch (type) {
      case NotificationType.TASK_COMPLETED:
        return t('notifications.types.taskCompleted');
      case NotificationType.TASK_FAILED:
        return t('notifications.types.taskFailed');
      case NotificationType.BADGE_AWARDED:
        return t('notifications.types.badgeAwarded');
      case NotificationType.COURSE_UNLOCKED:
        return t('notifications.types.courseUnlocked');
      case NotificationType.AI_REVIEW_READY:
        return t('notifications.types.aiReviewReady');
      case NotificationType.NEW_DISCUSSION:
        return t('notifications.types.newDiscussion');
      case NotificationType.MENTOR_REPLY:
        return t('notifications.types.mentorReply');
      case NotificationType.MENTOR_MENTION:
        return t('notifications.types.mentorMention');
      case NotificationType.SYSTEM_ANNOUNCEMENT:
        return t('notifications.types.systemAnnouncement');
      default:
        return type.replace(/_/g, ' ');
    }
  };

  return (
    <Layout className="min-h-screen bg-slate-50">
      <TopNavbar title={t('title')} />
      <Content className="p-8 max-w-4xl mx-auto w-full">
        <Title level={2} className="mb-6">
          {t('title')}
        </Title>

        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <Tabs
            defaultActiveKey="profile"
            items={[
              {
                key: 'profile',
                label: t('tabs.profile'),
                children: (
                  <div className="max-w-md pt-4">
                    <Form form={profileForm} layout="vertical" onFinish={onUpdateProfile}>
                      <Form.Item label={t('profile.username')} name="username">
                        <Input disabled />
                      </Form.Item>
                      <Form.Item label={t('profile.nickname')} name="nickname">
                        <Input placeholder={t('profile.nicknamePlaceholder')} />
                      </Form.Item>
                      <Form.Item
                        label={t('profile.email')}
                        name="email"
                        rules={[{ type: 'email' }]}
                      >
                        <Input placeholder={t('profile.emailPlaceholder')} />
                      </Form.Item>
                      <Form.Item>
                        <Button type="primary" htmlType="submit" loading={loading}>
                          {t('profile.save')}
                        </Button>
                      </Form.Item>
                    </Form>
                  </div>
                ),
              },
              {
                key: 'security',
                label: t('tabs.security'),
                children: (
                  <div className="max-w-md pt-4">
                    <Title level={5}>{t('security.title')}</Title>
                    <Divider className="my-3" />
                    <Form form={passwordForm} layout="vertical" onFinish={onChangePassword}>
                      <Form.Item
                        label={t('security.currentPassword')}
                        name="currentPassword"
                        rules={[{ required: true, message: t('security.currentPasswordRequired') }]}
                      >
                        <Input.Password />
                      </Form.Item>
                      <Form.Item
                        label={t('security.newPassword')}
                        name="newPassword"
                        rules={[
                          { required: true, message: t('security.newPasswordRequired') },
                          { min: 6 },
                        ]}
                      >
                        <Input.Password />
                      </Form.Item>
                      <Form.Item
                        label={t('security.confirmPassword')}
                        name="confirmPassword"
                        dependencies={['newPassword']}
                        rules={[
                          { required: true, message: t('security.confirmPasswordRequired') },
                          ({ getFieldValue }) => ({
                            validator(_, value) {
                              if (!value || getFieldValue('newPassword') === value) {
                                return Promise.resolve();
                              }
                              return Promise.reject(new Error(t('security.passwordMismatch')));
                            },
                          }),
                        ]}
                      >
                        <Input.Password />
                      </Form.Item>
                      <Form.Item>
                        <Button type="primary" htmlType="submit" loading={loading}>
                          {t('security.change')}
                        </Button>
                      </Form.Item>
                    </Form>
                  </div>
                ),
              },
              {
                key: 'notifications',
                label: t('tabs.notifications'),
                children: (
                  <div className="max-w-2xl pt-4">
                    <Title level={5}>{t('notifications.title')}</Title>
                    <Text type="secondary" className="block mb-4">
                      {t('notifications.description')}
                    </Text>

                    <List
                      itemLayout="horizontal"
                      dataSource={notificationPrefs}
                      renderItem={(pref) => (
                        <List.Item
                          actions={[
                            <Switch
                              checked={pref.enabled}
                              onChange={(checked) => onTogglePreference(pref.type, checked)}
                            />,
                          ]}
                        >
                          <List.Item.Meta
                            title={getNotificationLabel(pref.type)}
                            description={t('notifications.receiveDescription', {
                              type: getNotificationLabel(pref.type),
                            })}
                          />
                        </List.Item>
                      )}
                    />
                  </div>
                ),
              },
            ]}
          />
        </div>
      </Content>
    </Layout>
  );
};
