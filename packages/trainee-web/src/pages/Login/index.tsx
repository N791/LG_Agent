import React, { useState } from 'react';
import { Form, Input, Button, Typography, message } from 'antd';
import { UserOutlined, LockOutlined, RocketOutlined } from '@ant-design/icons';
import { useDispatch } from 'react-redux';
import { useNavigate, useLocation } from 'react-router-dom';
import request from '../../utils/request';
import { setCredentials } from '../../store/authSlice';

const { Title, Text } = Typography;

interface LoginValues {
  username?: string;
  password?: string;
}

interface JwtPayload {
  sub: string;
  username: string;
  role: string;
}

const Login: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const location = useLocation();

  const state = location.state as { from?: { pathname: string } } | null;
  const from = state?.from?.pathname ?? '/mission-hub';

  const onFinish = async (values: LoginValues) => {
    setLoading(true);
    try {
      const res = (await request.post<{ access_token: string }>('/auth/login', {
        username: values.username,
        password: values.password,
      })) as { data?: { access_token?: string }; access_token?: string };
      // Extract token (handling NestJS transform interceptor wrapper if present)
      const token: string | undefined = res.data?.access_token ?? res.access_token;

      if (!token) {
        throw new Error('Token not found in response');
      }

      let decoded: JwtPayload;
      try {
        const base64Url = token.split('.')[1];
        if (!base64Url) throw new Error('Invalid token');
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        // Add padding if needed
        const pad = base64.length % 4;
        const paddedBase64 = pad ? base64 + '='.repeat(4 - pad) : base64;
        const jsonPayload = decodeURIComponent(
          atob(paddedBase64)
            .split('')
            .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
            .join(''),
        );
        decoded = JSON.parse(jsonPayload) as JwtPayload;
      } catch (err) {
        console.error('Failed to parse JWT token:', err);
        throw new Error('Token parsing failed');
      }

      dispatch(
        setCredentials({
          user: {
            id: decoded.sub,
            email: decoded.username, // using username as email for trainee
            name: decoded.username,
            role: decoded.role,
          },
          token,
        }),
      );

      void message.success('Welcome back, Trainee!');
      navigate(from, { replace: true });
    } catch (error: unknown) {
      console.error('Login error', error);
      const errRes = error as { response?: { data?: { message?: string } } };
      void message.error(
        errRes.response?.data?.message ?? 'Login failed. Please check your credentials.',
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-900 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-gray-800 via-gray-900 to-black overflow-hidden relative">
      {/* Abstract background shapes */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-blue-600/20 blur-[100px] pointer-events-none"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-purple-600/20 blur-[120px] pointer-events-none"></div>

      <div className="relative z-10 w-full max-w-md">
        <div className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-2xl p-10 shadow-2xl">
          <div className="text-center mb-8 flex flex-col items-center">
            <div className="w-16 h-16 bg-gradient-to-tr from-blue-500 to-purple-500 rounded-2xl flex items-center justify-center shadow-lg mb-4">
              <RocketOutlined className="text-3xl text-white" />
            </div>
            <Title level={2} className="!text-white !mb-2">
              Mission Control
            </Title>
            <Text className="text-gray-400">Sign in to access your training workspace</Text>
          </div>

          <Form
            name="login"
            initialValues={{ remember: true }}
            onFinish={(values: LoginValues) => {
              void onFinish(values);
            }}
            size="large"
            layout="vertical"
            className="w-full"
          >
            <Form.Item
              name="username"
              rules={[{ required: true, message: 'Please input your Username!' }]}
            >
              <Input
                prefix={<UserOutlined className="text-gray-400" />}
                placeholder="Username (e.g. trainee)"
                className="rounded-xl h-12"
              />
            </Form.Item>

            <Form.Item
              name="password"
              rules={[{ required: true, message: 'Please input your Password!' }]}
            >
              <Input.Password
                prefix={<LockOutlined className="text-gray-400" />}
                placeholder="Password"
                className="rounded-xl h-12"
              />
            </Form.Item>

            <Form.Item className="mt-8 mb-0">
              <Button
                type="primary"
                htmlType="submit"
                loading={loading}
                className="w-full h-12 rounded-xl bg-gradient-to-r from-blue-500 to-purple-500 border-none hover:opacity-90 font-medium text-lg shadow-lg"
              >
                Sign In
              </Button>
            </Form.Item>
          </Form>
        </div>
        <div className="text-center mt-6 text-gray-500 text-sm">
          &copy; {new Date().getFullYear()} LG Agent Platform. All rights reserved.
        </div>
      </div>
    </div>
  );
};

export default Login;
