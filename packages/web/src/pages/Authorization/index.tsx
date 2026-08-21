import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Button,
  Checkbox,
  Empty,
  Input,
  List,
  Modal,
  Select,
  Skeleton,
  Space,
  Tag,
  Typography,
  message,
} from 'antd';
import {
  CopyOutlined,
  PlusOutlined,
  SafetyCertificateOutlined,
  TeamOutlined,
} from '@ant-design/icons';
import type { AuthorizationRoleDTO, Permission, PermissionDefinition } from '@lg-agent/contracts';
import { PERMISSIONS } from '@lg-agent/contracts';
import { PermissionButton } from '@lg-agent/permission-react';
import type { User } from '../../types';
import { authorizationApi, type PermissionImpact } from '../../services/authorization';
import { useTranslation } from 'react-i18next';

const { Title, Text, Paragraph } = Typography;

interface ConfirmState {
  mode: 'permissions' | 'members';
  impact?: PermissionImpact;
}

const Authorization: React.FC = () => {
  const { t } = useTranslation('admin');
  const [roles, setRoles] = useState<AuthorizationRoleDTO[]>([]);
  const [registry, setRegistry] = useState<PermissionDefinition[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [selectedRoleId, setSelectedRoleId] = useState('');
  const [permissionDraft, setPermissionDraft] = useState<Permission[]>([]);
  const [memberDraft, setMemberDraft] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirm, setConfirm] = useState<ConfirmState | null>(null);
  const [confirmationText, setConfirmationText] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [copySource, setCopySource] = useState<AuthorizationRoleDTO | null>(null);
  const [roleName, setRoleName] = useState('');
  const [roleDescription, setRoleDescription] = useState('');

  const selectedRole = roles.find((role) => role.id === selectedRoleId) ?? null;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [nextRoles, nextRegistry, nextUsers] = await Promise.all([
        authorizationApi.listRoles(),
        authorizationApi.listPermissions(),
        authorizationApi.listUsers(),
      ]);
      setRoles(nextRoles);
      setRegistry(nextRegistry);
      setUsers(nextUsers);
      setSelectedRoleId((current) =>
        nextRoles.some((role) => role.id === current) ? current : (nextRoles[0]?.id ?? ''),
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    setPermissionDraft(selectedRole?.permissions ?? []);
    setMemberDraft(selectedRole?.memberIds ?? []);
  }, [selectedRole]);

  const groupedPermissions = useMemo(() => {
    const groups = new Map<string, PermissionDefinition[]>();
    for (const permission of registry) {
      const resource = permission.key.split(':')[0] ?? permission.key;
      const group = groups.get(resource) ?? [];
      group.push(permission);
      groups.set(resource, group);
    }
    return [...groups.entries()];
  }, [registry]);

  const beginPermissionSave = async () => {
    if (!selectedRole) return;
    const impact = await authorizationApi.preview(selectedRole.id, permissionDraft);
    setConfirmationText('');
    setConfirm({ mode: 'permissions', impact });
  };

  const beginMemberSave = () => {
    setConfirmationText('');
    setConfirm({ mode: 'members' });
  };

  const applyConfirmedChange = async () => {
    if (selectedRole?.name !== confirmationText || !confirm) return;
    if (confirm.mode === 'permissions') {
      await authorizationApi.updatePermissions(selectedRole.id, permissionDraft, confirmationText);
      void message.success(t('authorization.permissionSaved'));
    } else {
      await authorizationApi.assignMembers(selectedRole.id, memberDraft, confirmationText);
      void message.success(t('authorization.membersSaved'));
    }
    setConfirm(null);
    await load();
  };

  const openCreate = (source?: AuthorizationRoleDTO) => {
    setCopySource(source ?? null);
    setRoleName(source ? `${source.name} ${t('authorization.copySuffix')}` : '');
    setRoleDescription(source?.description ?? '');
    setCreateOpen(true);
  };

  const submitCreate = async () => {
    if (!roleName.trim()) return;
    const created = copySource
      ? await authorizationApi.copyRole(copySource.id, {
          name: roleName.trim(),
          description: roleDescription.trim(),
        })
      : await authorizationApi.createRole({
          name: roleName.trim(),
          description: roleDescription.trim(),
        });
    setCreateOpen(false);
    await load();
    setSelectedRoleId(created.id);
  };

  if (loading && roles.length === 0) {
    return <Skeleton active paragraph={{ rows: 8 }} />;
  }

  return (
    <div className="max-w-[1440px] mx-auto">
      <div className="flex items-start justify-between gap-6 mb-7">
        <div>
          <Space size={10}>
            <SafetyCertificateOutlined className="text-blue-600 text-2xl" />
            <Title level={2} className="!mb-0">
              {t('authorization.title')}
            </Title>
          </Space>
          <Paragraph type="secondary" className="!mt-2 !mb-0 max-w-2xl">
            {t('authorization.description')}
          </Paragraph>
        </div>
        <PermissionButton permission={PERMISSIONS.ROLE_MANAGE}>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => {
              openCreate();
            }}
          >
            {t('authorization.createRole')}
          </Button>
        </PermissionButton>
      </div>

      <div className="grid grid-cols-[280px_minmax(0,1fr)] border border-slate-200 rounded-xl overflow-hidden min-h-[620px] bg-white">
        <aside className="bg-slate-50 border-r border-slate-200 p-3">
          <div className="px-3 py-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
            {t('authorization.rolesCount', { count: roles.length })}
          </div>
          <List
            dataSource={roles}
            locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} /> }}
            renderItem={(role) => (
              <List.Item
                className={`!px-3 !py-3 !border-0 rounded-lg cursor-pointer mb-1 ${
                  role.id === selectedRoleId ? 'bg-blue-600 !text-white' : 'hover:bg-slate-100'
                }`}
                onClick={() => {
                  setSelectedRoleId(role.id);
                }}
              >
                <div className="min-w-0 w-full">
                  <div className="flex items-center justify-between gap-2">
                    <Text
                      strong
                      ellipsis
                      className={role.id === selectedRoleId ? '!text-white' : ''}
                    >
                      {role.system
                        ? t(`authorization.systemRoles.${role.key}`, { defaultValue: role.name })
                        : role.name}
                    </Text>
                    {role.system ? (
                      <Tag bordered={false} color={role.id === selectedRoleId ? 'blue' : 'default'}>
                        {t('authorization.builtIn')}
                      </Tag>
                    ) : null}
                  </div>
                  <div
                    className={`text-xs mt-1 ${
                      role.id === selectedRoleId ? 'text-blue-100' : 'text-slate-500'
                    }`}
                  >
                    {t('authorization.roleStats', {
                      members: role.memberCount,
                      permissions: role.permissions.length,
                    })}
                  </div>
                </div>
              </List.Item>
            )}
          />
        </aside>

        <main className="p-7 min-w-0">
          {selectedRole ? (
            <>
              <div className="flex justify-between gap-4 pb-5 border-b border-slate-200">
                <div>
                  <Space>
                    <Title level={3} className="!mb-0">
                      {selectedRole.system
                        ? t(`authorization.systemRoles.${selectedRole.key}`, {
                            defaultValue: selectedRole.name,
                          })
                        : selectedRole.name}
                    </Title>
                    {selectedRole.system ? <Tag>{t('authorization.readOnlyTemplate')}</Tag> : null}
                  </Space>
                  <Paragraph type="secondary" className="!mt-2 !mb-0">
                    {selectedRole.system
                      ? t(`authorization.systemRoleDescriptions.${selectedRole.key}`, {
                          defaultValue:
                            selectedRole.description ?? t('authorization.noDescription'),
                        })
                      : (selectedRole.description ?? t('authorization.noDescription'))}
                  </Paragraph>
                </div>
                <PermissionButton permission={PERMISSIONS.ROLE_MANAGE}>
                  <Button
                    icon={<CopyOutlined />}
                    onClick={() => {
                      openCreate(selectedRole);
                    }}
                  >
                    {t('authorization.copyRole')}
                  </Button>
                </PermissionButton>
              </div>

              {selectedRole.system ? (
                <Alert
                  className="!my-5"
                  type="info"
                  showIcon
                  message={t('authorization.builtInStable')}
                  description={t('authorization.copyToCustomize')}
                />
              ) : null}

              <section className="py-5 border-b border-slate-200">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <Text strong>{t('authorization.permissionMatrix')}</Text>
                    <div className="text-sm text-slate-500">
                      {t('authorization.uncheckedDenied')}
                    </div>
                  </div>
                  {!selectedRole.system ? (
                    <PermissionButton permission={PERMISSIONS.ROLE_MANAGE}>
                      <Button type="primary" onClick={() => void beginPermissionSave()}>
                        {t('authorization.reviewChanges')}
                      </Button>
                    </PermissionButton>
                  ) : null}
                </div>
                <Checkbox.Group
                  value={permissionDraft}
                  disabled={selectedRole.system}
                  onChange={(values) => {
                    setPermissionDraft(values);
                  }}
                  className="!grid grid-cols-1 xl:grid-cols-2 gap-3 w-full"
                >
                  {groupedPermissions.map(([resource, permissions]) => (
                    <div key={resource} className="border border-slate-200 rounded-lg p-4">
                      <div className="font-mono text-xs uppercase tracking-wide text-slate-500 mb-3">
                        {resource}
                      </div>
                      <Space direction="vertical" size={10}>
                        {permissions.map((permission) => (
                          <Checkbox key={permission.key} value={permission.key}>
                            <span className="font-medium">{permission.key}</span>
                            {permission.risk === 'HIGH' ? (
                              <Tag color="orange" className="!ml-2">
                                {t('authorization.highRisk')}
                              </Tag>
                            ) : null}
                            <div className="text-xs text-slate-500 mt-0.5">
                              {t(
                                `authorization.permissionDescriptions.${permission.key.replaceAll(':', '_').replaceAll('-', '_')}`,
                                {
                                  defaultValue: permission.description,
                                },
                              )}
                            </div>
                          </Checkbox>
                        ))}
                      </Space>
                    </div>
                  ))}
                </Checkbox.Group>
              </section>

              <section className="pt-5">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <Space>
                      <TeamOutlined />
                      <Text strong>{t('authorization.members')}</Text>
                    </Space>
                    <div className="text-sm text-slate-500 mt-1">
                      {t('authorization.membersHelp')}
                    </div>
                  </div>
                  {!selectedRole.system || selectedRole.key !== 'TRAINEE' ? (
                    <PermissionButton permission={PERMISSIONS.ROLE_MANAGE}>
                      <Button onClick={beginMemberSave}>
                        {t('authorization.reviewAssignment')}
                      </Button>
                    </PermissionButton>
                  ) : null}
                </div>
                <Select
                  mode="multiple"
                  className="w-full !mt-4"
                  value={memberDraft}
                  onChange={setMemberDraft}
                  optionFilterProp="label"
                  options={users.map((user) => ({
                    value: user.id,
                    label: `${user.nickname ?? user.username} · ${user.email ?? user.username}`,
                  }))}
                  placeholder={t('authorization.chooseMembers')}
                />
              </section>
            </>
          ) : (
            <Empty description={t('authorization.selectRole')} />
          )}
        </main>
      </div>

      <Modal
        open={Boolean(confirm)}
        title={t('authorization.confirmTitle')}
        okText={t('authorization.applyChange')}
        okButtonProps={{ danger: true, disabled: confirmationText !== selectedRole?.name }}
        onCancel={() => {
          setConfirm(null);
        }}
        onOk={() => void applyConfirmedChange()}
      >
        {confirm?.impact ? (
          <Alert
            type={confirm.impact.highRisk ? 'warning' : 'info'}
            showIcon
            message={t('authorization.impact', { count: confirm.impact.memberCount })}
            description={t('authorization.permissionDelta', {
              added: confirm.impact.added.length,
              removed: confirm.impact.removed.length,
            })}
            className="!mb-4"
          />
        ) : (
          <Alert
            type="warning"
            showIcon
            message={t('authorization.memberHolding', { count: memberDraft.length })}
            className="!mb-4"
          />
        )}
        <Paragraph>
          {t('authorization.enterToConfirm', { name: selectedRole?.name ?? '' })}
        </Paragraph>
        <Input
          value={confirmationText}
          onChange={(event) => {
            setConfirmationText(event.target.value);
          }}
        />
      </Modal>

      <Modal
        open={createOpen}
        title={copySource ? t('authorization.copyRoleTitle') : t('authorization.createCustomRole')}
        okText={copySource ? t('authorization.copyRole') : t('authorization.createRole')}
        okButtonProps={{ disabled: !roleName.trim() }}
        onCancel={() => {
          setCreateOpen(false);
        }}
        onOk={() => void submitCreate()}
      >
        <Space direction="vertical" className="w-full" size={14}>
          <label className="w-full">
            <div className="text-sm font-medium mb-1">{t('authorization.roleName')}</div>
            <Input
              value={roleName}
              onChange={(event) => {
                setRoleName(event.target.value);
              }}
            />
          </label>
          <label className="w-full">
            <div className="text-sm font-medium mb-1">{t('authorization.roleDescription')}</div>
            <Input.TextArea
              value={roleDescription}
              rows={3}
              onChange={(event) => {
                setRoleDescription(event.target.value);
              }}
            />
          </label>
        </Space>
      </Modal>
    </div>
  );
};

export default Authorization;
