import React, { useState } from 'react';
import { Form, Input, Button, message } from 'antd';
import { UserOutlined, LockOutlined } from '@ant-design/icons';
import { useDispatch } from 'react-redux';
import { setAuth } from '../../store/slices/authSlice';
import { useNavigate, useLocation } from 'react-router-dom';
import request from '../../utils/request';
import { Role } from '../../types';
import { useTranslation } from 'react-i18next';
import lgAgentMark from '../../assets/lg-agent-mark.svg';

interface JwtPayload {
  sub: string;
  username: string;
  role: Role;
  organizationId?: string;
}

// Function to decode JWT to extract user info simply (for demo/prototype purposes)
function parseJwt(token: string): JwtPayload | null {
  try {
    const base64Url = token.split('.')[1];
    if (!base64Url) return null;
    return JSON.parse(atob(base64Url)) as JwtPayload;
  } catch (_e) {
    return null;
  }
}

const Login: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useTranslation('auth');

  const state = location.state as { from?: { pathname?: string } } | null;
  const from = state?.from?.pathname ?? '/';

  const onFinish = async (values: Record<string, unknown>) => {
    try {
      setLoading(true);
      const data = (await request.post('/auth/login', values)) as unknown as {
        access_token: string;
      };

      const token = data.access_token;
      const decoded = parseJwt(token);

      if (decoded) {
        dispatch(
          setAuth({
            token,
            user: {
              id: decoded.sub,
              username: decoded.username,
              role: decoded.role,
              organizationId: decoded.organizationId ?? '', // Make sure API returns it in JWT payload or it will be empty
            },
          }),
        );
      }

      void message.success(t('loginSuccess'));
      navigate(from, { replace: true });
    } catch (_error) {
      // Error handled by interceptor
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="flex flex-col items-center sm:mx-auto sm:w-full sm:max-w-md">
        <img src={lgAgentMark} alt="LG Agent" className="block h-16 w-16" />
        <h2 className="mt-4 text-center text-3xl font-bold tracking-tight text-slate-900">
          LG Agent
        </h2>
        <p className="mt-2 text-center text-sm text-gray-600">{t('subtitle')}</p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
          <Form
            name="login_form"
            onFinish={(values) => void onFinish(values as Record<string, unknown>)}
            layout="vertical"
            size="large"
          >
            <Form.Item name="username" rules={[{ required: true, message: t('usernameRequired') }]}>
              <Input
                prefix={<UserOutlined className="text-gray-400" />}
                placeholder={t('usernamePlaceholder')}
              />
            </Form.Item>

            <Form.Item name="password" rules={[{ required: true, message: t('passwordRequired') }]}>
              <Input.Password
                prefix={<LockOutlined className="text-gray-400" />}
                placeholder={t('passwordPlaceholder')}
              />
            </Form.Item>

            <Form.Item>
              <Button type="primary" htmlType="submit" className="w-full" loading={loading}>
                {t('loginButton')}
              </Button>
            </Form.Item>
          </Form>
        </div>
      </div>
    </div>
  );
};

export default Login;
