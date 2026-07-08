import React from 'react';
import { Card, Statistic, Row, Col } from 'antd';

const Dashboard: React.FC = () => {
  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">控制台</h1>
      <Row gutter={16}>
        <Col span={8}>
          <Card>
            <Statistic title="活跃课程" value={12} />
          </Card>
        </Col>
        <Col span={8}>
          <Card>
            <Statistic title="学习任务" value={143} />
          </Card>
        </Col>
        <Col span={8}>
          <Card>
            <Statistic title="在线用户" value={24} />
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default Dashboard;
