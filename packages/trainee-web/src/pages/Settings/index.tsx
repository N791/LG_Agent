import React, { useState, useEffect } from 'react';
import { Layout, Typography, Tabs, Form, Input, Button, Switch, List, message, Divider } from 'antd';
import { TopNavbar } from '../../components/TopNavbar';
import { useSelector, useDispatch } from 'react-redux';
import { RootState } from '../../store';
import { setCredentials } from '../../store/authSlice';
import api from '../../services/api';
import { notificationService } from '../../services/notification.service';
import { NotificationType } from '@lg-agent/contracts';

const { Content } = Layout;
const { Title, Text } = Typography;

export const Settings: React.FC = () => {
  const user = useSelector((state: RootState) => state.auth.user);
  const token = useSelector((state: RootState) => state.auth.token);
  const refreshToken = useSelector((state: RootState) => state.auth.refreshToken);
  const tokenExpiresAt = useSelector((state: RootState) => state.auth.tokenExpiresAt);
  const dispatch = useDispatch();

  const [profileForm] = Form.useForm();
  const [passwordForm] = Form.useForm();
  const [loading, setLoading] = useState(false);
  
  const [notificationPrefs, setNotificationPrefs] = useState<{type: string, enabled: boolean}[]>([]);

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
      message.success('Profile updated successfully');
      
      // Update local Redux state
      if (user && token && refreshToken && tokenExpiresAt) {
        dispatch(setCredentials({
          user: response.data,
          token,
          refreshToken,
          tokenExpiresAt
        }));
      }
    } catch (error) {
      message.error('Failed to update profile');
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
      message.success('Password changed successfully');
      passwordForm.resetFields();
    } catch (error: any) {
      message.error(error.response?.data?.message || 'Failed to change password');
    } finally {
      setLoading(false);
    }
  };

  const onTogglePreference = async (type: string, checked: boolean) => {
    try {
      await notificationService.updatePreference(type, checked);
      setNotificationPrefs(prev => 
        prev.map(p => p.type === type ? { ...p, enabled: checked } : p)
      );
      message.success('Preference updated');
    } catch (err) {
      message.error('Failed to update preference');
    }
  };

  const getNotificationLabel = (type: string) => {
    switch (type) {
      case NotificationType.TASK_COMPLETED: return 'Task Passed';
      case NotificationType.TASK_FAILED: return 'Task Failed';
      case NotificationType.BADGE_AWARDED: return 'Badges & Achievements';
      case NotificationType.COURSE_UNLOCKED: return 'Course Unlocked';
      case NotificationType.AI_REVIEW_READY: return 'AI Review Ready';
      default: return type.replace(/_/g, ' ');
    }
  };

  return (
    <Layout className="min-h-screen bg-slate-50">
      <TopNavbar title="Personal Settings" />
      <Content className="p-8 max-w-4xl mx-auto w-full">
        <Title level={2} className="mb-6">Settings</Title>
        
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <Tabs
            defaultActiveKey="profile"
            items={[
              {
                key: 'profile',
                label: 'Profile',
                children: (
                  <div className="max-w-md pt-4">
                    <Form
                      form={profileForm}
                      layout="vertical"
                      onFinish={onUpdateProfile}
                    >
                      <Form.Item label="Username (Read-only)" name="username">
                        <Input disabled />
                      </Form.Item>
                      <Form.Item label="Nickname" name="nickname">
                        <Input placeholder="How should we call you?" />
                      </Form.Item>
                      <Form.Item label="Email" name="email" rules={[{ type: 'email' }]}>
                        <Input placeholder="your.email@example.com" />
                      </Form.Item>
                      <Form.Item>
                        <Button type="primary" htmlType="submit" loading={loading}>
                          Save Profile
                        </Button>
                      </Form.Item>
                    </Form>
                  </div>
                ),
              },
              {
                key: 'security',
                label: 'Security',
                children: (
                  <div className="max-w-md pt-4">
                    <Title level={5}>Change Password</Title>
                    <Divider className="my-3" />
                    <Form
                      form={passwordForm}
                      layout="vertical"
                      onFinish={onChangePassword}
                    >
                      <Form.Item 
                        label="Current Password" 
                        name="currentPassword"
                        rules={[{ required: true, message: 'Please input current password' }]}
                      >
                        <Input.Password />
                      </Form.Item>
                      <Form.Item 
                        label="New Password" 
                        name="newPassword"
                        rules={[{ required: true, message: 'Please input new password' }, { min: 6 }]}
                      >
                        <Input.Password />
                      </Form.Item>
                      <Form.Item 
                        label="Confirm New Password" 
                        name="confirmPassword"
                        dependencies={['newPassword']}
                        rules={[
                          { required: true, message: 'Please confirm new password' },
                          ({ getFieldValue }) => ({
                            validator(_, value) {
                              if (!value || getFieldValue('newPassword') === value) {
                                return Promise.resolve();
                              }
                              return Promise.reject(new Error('The new passwords do not match!'));
                            },
                          }),
                        ]}
                      >
                        <Input.Password />
                      </Form.Item>
                      <Form.Item>
                        <Button type="primary" htmlType="submit" loading={loading}>
                          Change Password
                        </Button>
                      </Form.Item>
                    </Form>
                  </div>
                ),
              },
              {
                key: 'notifications',
                label: 'Notifications',
                children: (
                  <div className="max-w-2xl pt-4">
                    <Title level={5}>Notification Preferences</Title>
                    <Text type="secondary" className="block mb-4">
                      Choose which notifications you want to receive.
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
                            />
                          ]}
                        >
                          <List.Item.Meta
                            title={getNotificationLabel(pref.type)}
                            description={`Receive notifications for ${getNotificationLabel(pref.type).toLowerCase()}`}
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
